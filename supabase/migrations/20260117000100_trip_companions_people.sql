-- Trip Companions: People + membership/join tables ---------------------------
-- Goal: introduce a global per-user "people" entity, allow people in multiple groups,
-- and allow trips to reference multiple groups and people (dynamic membership).

-- People ---------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint people_first_name_present check (nullif(trim(first_name), '') is not null),
  constraint people_first_name_length check (char_length(first_name) <= 40),
  constraint people_last_name_length check (last_name is null or char_length(last_name) <= 40)
);

create unique index if not exists people_user_unique_name
  on public.people (user_id, lower(first_name), lower(coalesce(last_name, '')));

create trigger set_people_updated_at
before update on public.people
for each row
execute procedure handle_updated_at();

alter table public.people enable row level security;

create policy "Users manage people"
  on public.people
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create function public.is_owner_of_person(person_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.people p
    where p.id = person_id
      and p.user_id = auth.uid()
  );
$$ language sql stable;

-- Trip group membership (many-to-many) ---------------------------------------
create table if not exists public.trip_group_people (
  trip_group_id uuid not null references public.trip_groups (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (trip_group_id, person_id)
);

alter table public.trip_group_people enable row level security;

create policy "Users manage trip group people"
  on public.trip_group_people
  using (
    public.is_owner_of_trip_group(trip_group_id)
    and public.is_owner_of_person(person_id)
  )
  with check (
    public.is_owner_of_trip_group(trip_group_id)
    and public.is_owner_of_person(person_id)
  );

-- Trip companions (many-to-many): selected groups and selected people ---------
create table if not exists public.trip_companion_groups (
  trip_id uuid not null references public.trips (id) on delete cascade,
  trip_group_id uuid not null references public.trip_groups (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (trip_id, trip_group_id)
);

alter table public.trip_companion_groups enable row level security;

create policy "Users manage trip companion groups"
  on public.trip_companion_groups
  using (
    public.is_owner_of_trip(trip_id)
    and public.is_owner_of_trip_group(trip_group_id)
  )
  with check (
    public.is_owner_of_trip(trip_id)
    and public.is_owner_of_trip_group(trip_group_id)
  );

create table if not exists public.trip_companion_people (
  trip_id uuid not null references public.trips (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (trip_id, person_id)
);

alter table public.trip_companion_people enable row level security;

create policy "Users manage trip companion people"
  on public.trip_companion_people
  using (
    public.is_owner_of_trip(trip_id)
    and public.is_owner_of_person(person_id)
  )
  with check (
    public.is_owner_of_trip(trip_id)
    and public.is_owner_of_person(person_id)
  );

-- Backfill -------------------------------------------------------------------
-- 1) Convert legacy trip_group_members (name strings) into global people rows
--    and connect them to groups.
insert into public.people (user_id, first_name, last_name)
select distinct
  tg.user_id,
  coalesce(nullif(trim(tgm.first_name), ''), nullif(trim(tgm.last_name), ''), 'Unknown') as first_name,
  case
    when nullif(trim(tgm.first_name), '') is null then null
    else nullif(trim(tgm.last_name), '')
  end as last_name
from public.trip_group_members tgm
join public.trip_groups tg on tg.id = tgm.trip_group_id
on conflict (user_id, lower(first_name), lower(coalesce(last_name, '')))
do nothing;

insert into public.trip_group_people (trip_group_id, person_id)
select distinct
  tgm.trip_group_id,
  p.id
from public.trip_group_members tgm
join public.trip_groups tg on tg.id = tgm.trip_group_id
join public.people p
  on p.user_id = tg.user_id
  and lower(p.first_name) = lower(coalesce(nullif(trim(tgm.first_name), ''), nullif(trim(tgm.last_name), ''), 'Unknown'))
  and lower(coalesce(p.last_name, '')) = lower(
    coalesce(
      case
        when nullif(trim(tgm.first_name), '') is null then ''
        else coalesce(nullif(trim(tgm.last_name), ''), '')
      end,
      ''
    )
  )
on conflict (trip_group_id, person_id)
do nothing;

-- 2) Convert legacy single trip_group_id into a companion-group association.
insert into public.trip_companion_groups (trip_id, trip_group_id)
select t.id, t.trip_group_id
from public.trips t
where t.trip_group_id is not null
on conflict (trip_id, trip_group_id)
do nothing;

