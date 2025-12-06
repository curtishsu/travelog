-- Adjust trip_days policy to use trip_id for RLS checks during insert
drop policy if exists "Users manage trip days" on public.trip_days;

create policy "Users manage trip days"
  on public.trip_days
  using (public.is_owner_of_trip(trip_id))
  with check (public.is_owner_of_trip(trip_id));




