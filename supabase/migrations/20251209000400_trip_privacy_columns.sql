alter table public.trips
  add column if not exists is_trip_content_locked boolean not null default false;

alter table public.trip_days
  add column if not exists is_locked boolean not null default false;

comment on column public.trips.is_trip_content_locked is 'Indicates whether all trip content is locked for guest mode.';
comment on column public.trip_days.is_locked is 'Indicates whether this day’s journal/highlights are locked.';

