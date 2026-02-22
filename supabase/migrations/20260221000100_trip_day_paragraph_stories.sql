-- Story paragraphs for per-day journal entries.
create table if not exists public.trip_day_paragraphs (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  position int not null,
  text text not null,
  is_story boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trip_day_paragraphs_position_positive check (position >= 1),
  unique (trip_day_id, position)
);

create trigger set_trip_day_paragraphs_updated_at
before update on public.trip_day_paragraphs
for each row
execute procedure handle_updated_at();

alter table public.trip_day_paragraphs enable row level security;

create policy "Users manage trip day paragraphs"
  on public.trip_day_paragraphs
  using (public.is_owner_of_trip_day(trip_day_id))
  with check (public.is_owner_of_trip_day(trip_day_id));

-- One-time backfill from legacy plain text journal entries.
insert into public.trip_day_paragraphs (trip_day_id, position, text, is_story)
select
  day_rows.id as trip_day_id,
  split_rows.ordinality::int as position,
  btrim(split_rows.value) as text,
  false as is_story
from public.trip_days as day_rows
cross join lateral regexp_split_to_table(
  coalesce(day_rows.journal_entry, ''),
  E'\\n\\n+'
) with ordinality as split_rows(value, ordinality)
where btrim(split_rows.value) <> '';

comment on table public.trip_day_paragraphs is 'Paragraph-level journal blocks for story curation and anchors.';
