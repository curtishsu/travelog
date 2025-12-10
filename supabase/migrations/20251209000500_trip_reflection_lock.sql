alter table public.trips
  add column if not exists is_reflection_locked boolean not null default false;

comment on column public.trips.is_reflection_locked is 'Indicates whether the trip-level reflection is locked.';

