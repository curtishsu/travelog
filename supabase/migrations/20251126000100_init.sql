-- Enable required extensions
create extension if not exists pgcrypto;

-- Timestamp trigger helper
drop function if exists handle_updated_at cascade;

create function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Trips -----------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  reflection text,
  status text not null check (status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trips_date_range check (end_date >= start_date),
  constraint trips_duration_max check ((end_date - start_date) <= 364)
);

create unique index trips_user_id_name_unique on public.trips (user_id, lower(name));

create trigger set_trips_updated_at
before update on public.trips
for each row
execute procedure handle_updated_at();

-- Trip Links ------------------------------------------------------------------
create table public.trip_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  url text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Trip Days -------------------------------------------------------------------
create table public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_index int not null,
  date date not null,
  highlight text,
  journal_entry text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trip_days_day_index_positive check (day_index >= 1),
  unique (trip_id, day_index),
  unique (trip_id, date)
);

create trigger set_trip_days_updated_at
before update on public.trip_days
for each row
execute procedure handle_updated_at();

-- Trip Locations --------------------------------------------------------------
create table public.trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  display_name text not null,
  city text,
  region text,
  country text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Photos ----------------------------------------------------------------------
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  trip_location_id uuid references public.trip_locations (id) on delete set null,
  thumbnail_url text not null,
  full_url text not null,
  width int,
  height int,
  created_at timestamptz not null default timezone('utc', now())
);

-- Trip Day Hashtags -----------------------------------------------------------
create table public.trip_day_hashtags (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  hashtag text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (trip_day_id, hashtag),
  constraint trip_day_hashtag_lowercase check (hashtag = lower(hashtag))
);

-- Trip Types ------------------------------------------------------------------
create table public.trip_types (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, type),
  constraint trip_type_lowercase check (type = lower(type))
);

-- Row Level Security ----------------------------------------------------------
alter table public.trips enable row level security;
alter table public.trip_links enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_locations enable row level security;
alter table public.photos enable row level security;
alter table public.trip_day_hashtags enable row level security;
alter table public.trip_types enable row level security;

-- Helper security predicates
create function public.is_owner_of_trip(trip_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and t.user_id = auth.uid()
  );
$$ language sql stable;

create function public.is_owner_of_trip_day(trip_day_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.trip_days td
    join public.trips t on t.id = td.trip_id
    where td.id = trip_day_id
      and t.user_id = auth.uid()
  );
$$ language sql stable;

-- Trips policies
create policy "Users can view their trips"
  on public.trips
  for select
  using (user_id = auth.uid());

create policy "Users can insert their trips"
  on public.trips
  for insert
  with check (user_id = auth.uid());

create policy "Users can update their trips"
  on public.trips
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their trips"
  on public.trips
  for delete
  using (user_id = auth.uid());

-- Trip links policies
create policy "Users manage trip links"
  on public.trip_links
  using (public.is_owner_of_trip(trip_id))
  with check (public.is_owner_of_trip(trip_id));

-- Trip days policies
create policy "Users manage trip days"
  on public.trip_days
  using (public.is_owner_of_trip_day(id))
  with check (public.is_owner_of_trip_day(id));

-- Trip locations policies
create policy "Users manage trip locations"
  on public.trip_locations
  using (public.is_owner_of_trip_day(trip_day_id))
  with check (public.is_owner_of_trip_day(trip_day_id));

-- Photos policies
create policy "Users manage photos"
  on public.photos
  using (public.is_owner_of_trip(trip_id))
  with check (public.is_owner_of_trip(trip_id));

-- Trip day hashtags policies
create policy "Users manage trip day hashtags"
  on public.trip_day_hashtags
  using (public.is_owner_of_trip_day(trip_day_id))
  with check (public.is_owner_of_trip_day(trip_day_id));

-- Trip types policies
create policy "Users manage trip types"
  on public.trip_types
  using (public.is_owner_of_trip(trip_id))
  with check (public.is_owner_of_trip(trip_id));

comment on table public.trips is 'User owned trips for Passport travel journal.';
comment on table public.trip_days is 'Per-day entries derived from trip date range.';
comment on table public.trip_locations is 'Geo-locations visited on a trip day.';
comment on table public.photos is 'Photo metadata linked to trips and trip days.';
comment on table public.trip_day_hashtags is 'Hashtags tagged on each trip day.';
comment on table public.trip_types is 'Trip-level types/tags for categorisation.';

