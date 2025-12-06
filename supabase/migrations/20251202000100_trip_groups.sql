-- Trip Groups schema ---------------------------------------------------------
create table public.trip_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trip_groups_name_length check (char_length(name) <= 16)
);

create unique index trip_groups_user_id_name_unique
  on public.trip_groups (user_id, lower(name));

create trigger set_trip_groups_updated_at
before update on public.trip_groups
for each row
execute procedure handle_updated_at();

create table public.trip_group_members (
  id uuid primary key default gen_random_uuid(),
  trip_group_id uuid not null references public.trip_groups (id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trip_group_member_name_present check (
    coalesce(nullif(trim(first_name), ''), nullif(trim(last_name), '')) is not null
  )
);

create unique index trip_group_members_unique_name_per_group
  on public.trip_group_members (
    trip_group_id,
    lower(coalesce(first_name, '')),
    lower(coalesce(last_name, ''))
  );

create trigger set_trip_group_members_updated_at
before update on public.trip_group_members
for each row
execute procedure handle_updated_at();

alter table public.trip_groups enable row level security;
alter table public.trip_group_members enable row level security;

create function public.is_owner_of_trip_group(trip_group_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.trip_groups tg
    where tg.id = trip_group_id
      and tg.user_id = auth.uid()
  );
$$ language sql stable;

create policy "Users manage trip groups"
  on public.trip_groups
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage trip group members"
  on public.trip_group_members
  using (public.is_owner_of_trip_group(trip_group_id))
  with check (public.is_owner_of_trip_group(trip_group_id));

alter table public.trips
  add column trip_group_id uuid references public.trip_groups (id) on delete set null;

drop policy if exists "Users can insert their trips" on public.trips;
drop policy if exists "Users can update their trips" on public.trips;

create policy "Users can insert their trips"
  on public.trips
  for insert
  with check (
    user_id = auth.uid()
    and (
      trip_group_id is null
      or public.is_owner_of_trip_group(trip_group_id)
    )
  );

create policy "Users can update their trips"
  on public.trips
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      trip_group_id is null
      or public.is_owner_of_trip_group(trip_group_id)
    )
  );



