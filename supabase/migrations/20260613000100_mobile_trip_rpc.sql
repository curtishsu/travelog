create or replace function public.mobile_overlap_warning(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_exclude_trip_id uuid default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with overlaps as (
    select id, name, start_date, end_date
    from public.trips
    where user_id = p_user_id
      and start_date <= p_end_date
      and end_date >= p_start_date
      and (p_exclude_trip_id is null or id <> p_exclude_trip_id)
  )
  select
    case
      when exists (select 1 from overlaps) then jsonb_build_object(
        'message', 'This trip overlaps with other trips.',
        'overlaps', (
          select jsonb_agg(
            jsonb_build_object(
              'id', id,
              'name', name,
              'start_date', start_date,
              'end_date', end_date
            )
            order by start_date desc
          )
          from overlaps
        )
      )
      else null
    end;
$$;

create or replace function public.mobile_trip_status(
  p_start_date date,
  p_end_date date
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when timezone('utc', now())::date > p_end_date then 'completed'
    when timezone('utc', now())::date >= p_start_date and timezone('utc', now())::date <= p_end_date then 'active'
    else 'draft'
  end;
$$;

create or replace function public.mobile_create_trip(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_timezone text default null,
  p_reflection text default null,
  p_trip_types text[] default '{}'::text[]
)
returns table (
  trip_id uuid,
  overlap_warning jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Trip name is required.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'endDate must be after startDate.';
  end if;

  if (p_end_date - p_start_date + 1) > 365 then
    raise exception 'Trip cannot exceed 365 days.';
  end if;

  insert into public.trips (
    user_id,
    name,
    timezone,
    start_date,
    end_date,
    reflection,
    status
  )
  values (
    v_user_id,
    trim(p_name),
    nullif(trim(coalesce(p_timezone, '')), ''),
    p_start_date,
    p_end_date,
    p_reflection,
    public.mobile_trip_status(p_start_date, p_end_date)
  )
  returning id into v_trip_id;

  insert into public.trip_days (trip_id, day_index, date)
  select
    v_trip_id,
    row_number() over (order by day_value),
    day_value
  from generate_series(p_start_date, p_end_date, interval '1 day') as day_value;

  insert into public.trip_types (trip_id, type)
  select
    v_trip_id,
    lower(trim(value))
  from unnest(coalesce(p_trip_types, '{}'::text[])) as value
  where trim(value) <> ''
  on conflict (trip_id, type) do nothing;

  return query
  select
    v_trip_id,
    public.mobile_overlap_warning(v_user_id, p_start_date, p_end_date, v_trip_id);
end;
$$;

grant execute on function public.mobile_create_trip(text, date, date, text, text, text[]) to authenticated;

create or replace function public.mobile_update_trip_overview(
  p_trip_id uuid,
  p_name text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_timezone text default null,
  p_reflection text default null,
  p_trip_types text[] default null
)
returns table (
  trip_id uuid,
  overlap_warning jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.trips%rowtype;
  v_start_date date;
  v_end_date date;
  v_day record;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into v_existing
  from public.trips
  where id = p_trip_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Trip not found.';
  end if;

  v_start_date := coalesce(p_start_date, v_existing.start_date);
  v_end_date := coalesce(p_end_date, v_existing.end_date);

  if trim(coalesce(p_name, v_existing.name, '')) = '' then
    raise exception 'Trip name is required.';
  end if;

  if v_end_date < v_start_date then
    raise exception 'endDate must be after startDate.';
  end if;

  if (v_end_date - v_start_date + 1) > 365 then
    raise exception 'Trip cannot exceed 365 days.';
  end if;

  for v_day in
    select td.id, td.date
    from public.trip_days td
    where td.trip_id = p_trip_id
      and (td.date < v_start_date or td.date > v_end_date)
  loop
    if exists (
      select 1
      from public.trip_days td
      left join public.trip_locations tl on tl.trip_day_id = td.id
      left join public.photos p on p.trip_day_id = td.id
      left join public.trip_day_hashtags h on h.trip_day_id = td.id
      left join public.trip_day_paragraphs par on par.trip_day_id = td.id
      where td.id = v_day.id
        and (
          nullif(trim(coalesce(td.highlight, '')), '') is not null
          or nullif(trim(coalesce(td.journal_entry, '')), '') is not null
          or tl.id is not null
          or p.id is not null
          or h.id is not null
          or par.id is not null
        )
    ) then
      raise exception 'Cannot shrink trip dates because removed days contain content.';
    end if;
  end loop;

  delete from public.trip_days
  where trip_id = p_trip_id
    and (date < v_start_date or date > v_end_date);

  insert into public.trip_days (trip_id, day_index, date)
  select
    p_trip_id,
    1000 + row_number() over (order by day_value),
    day_value
  from generate_series(v_start_date, v_end_date, interval '1 day') as day_value
  where not exists (
    select 1
    from public.trip_days td
    where td.trip_id = p_trip_id
      and td.date = day_value
  );

  update public.trip_days
  set day_index = day_index + 1000
  where trip_id = p_trip_id;

  with ordered_days as (
    select
      id,
      row_number() over (order by date) as next_index
    from public.trip_days
    where trip_id = p_trip_id
  )
  update public.trip_days td
  set day_index = ordered_days.next_index
  from ordered_days
  where td.id = ordered_days.id;

  update public.trips
  set
    name = trim(coalesce(p_name, v_existing.name)),
    start_date = v_start_date,
    end_date = v_end_date,
    timezone = case
      when p_timezone is null then v_existing.timezone
      when trim(p_timezone) = '' then null
      else trim(p_timezone)
    end,
    reflection = case
      when p_reflection is null then v_existing.reflection
      else nullif(p_reflection, '')
    end,
    status = public.mobile_trip_status(v_start_date, v_end_date)
  where id = p_trip_id;

  if p_trip_types is not null then
    delete from public.trip_types where trip_id = p_trip_id;

    insert into public.trip_types (trip_id, type)
    select
      p_trip_id,
      lower(trim(value))
    from unnest(coalesce(p_trip_types, '{}'::text[])) as value
    where trim(value) <> ''
    on conflict (trip_id, type) do nothing;
  end if;

  return query
  select
    p_trip_id,
    public.mobile_overlap_warning(v_user_id, v_start_date, v_end_date, p_trip_id);
end;
$$;

grant execute on function public.mobile_update_trip_overview(uuid, text, date, date, text, text, text[]) to authenticated;

create or replace function public.mobile_update_trip_day(
  p_trip_id uuid,
  p_day_index integer,
  p_highlight text default null,
  p_journal_entry text default null,
  p_paragraphs jsonb default null,
  p_is_favorite boolean default null,
  p_hashtags text[] default null,
  p_locations_to_add jsonb default null,
  p_location_ids_to_remove uuid[] default null,
  p_is_locked boolean default null
)
returns table (
  trip_day_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_day_id uuid;
  v_paragraph jsonb;
  v_location jsonb;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select td.id
  into v_trip_day_id
  from public.trip_days td
  join public.trips t on t.id = td.trip_id
  where td.trip_id = p_trip_id
    and td.day_index = p_day_index
    and t.user_id = v_user_id;

  if not found then
    raise exception 'Trip day not found.';
  end if;

  update public.trip_days
  set
    highlight = coalesce(p_highlight, highlight),
    journal_entry = coalesce(p_journal_entry, journal_entry),
    is_favorite = coalesce(p_is_favorite, is_favorite),
    is_locked = coalesce(p_is_locked, is_locked)
  where id = v_trip_day_id;

  if p_paragraphs is not null then
    delete from public.trip_day_paragraphs where trip_day_id = v_trip_day_id;

    for v_paragraph in
      select value from jsonb_array_elements(p_paragraphs)
    loop
      v_position := v_position + 1;
      insert into public.trip_day_paragraphs (
        id,
        trip_day_id,
        position,
        text,
        is_story
      )
      values (
        coalesce(nullif(v_paragraph->>'id', '')::uuid, gen_random_uuid()),
        v_trip_day_id,
        v_position,
        coalesce(v_paragraph->>'text', ''),
        coalesce((v_paragraph->>'isStory')::boolean, false)
      );
    end loop;
  end if;

  if p_hashtags is not null then
    delete from public.trip_day_hashtags where trip_day_id = v_trip_day_id;

    insert into public.trip_day_hashtags (trip_day_id, hashtag)
    select
      v_trip_day_id,
      lower(trim(regexp_replace(value, '^#', '')))
    from unnest(coalesce(p_hashtags, '{}'::text[])) as value
    where trim(value) <> ''
    on conflict (trip_day_id, hashtag) do nothing;
  end if;

  if p_location_ids_to_remove is not null then
    delete from public.trip_locations
    where trip_day_id = v_trip_day_id
      and id = any(p_location_ids_to_remove);
  end if;

  if p_locations_to_add is not null then
    for v_location in
      select value from jsonb_array_elements(p_locations_to_add)
    loop
      insert into public.trip_locations (
        trip_day_id,
        display_name,
        city,
        region,
        country,
        lat,
        lng
      )
      values (
        v_trip_day_id,
        coalesce(v_location->>'displayName', ''),
        nullif(v_location->>'city', ''),
        nullif(v_location->>'region', ''),
        nullif(v_location->>'country', ''),
        (v_location->>'lat')::double precision,
        (v_location->>'lng')::double precision
      );
    end loop;
  end if;

  return query select v_trip_day_id;
end;
$$;

grant execute on function public.mobile_update_trip_day(uuid, integer, text, text, jsonb, boolean, text[], jsonb, uuid[], boolean) to authenticated;
