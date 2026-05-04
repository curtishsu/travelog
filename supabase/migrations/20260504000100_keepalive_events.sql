create table public.keepalive_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint keepalive_events_source_nonempty check (length(trim(source)) > 0)
);

create index keepalive_events_created_at_idx on public.keepalive_events (created_at desc);

alter table public.keepalive_events enable row level security;

create policy "No direct client access to keepalive events"
  on public.keepalive_events
  for all
  using (false)
  with check (false);

comment on table public.keepalive_events is 'Internal cron heartbeat records used to keep the Supabase project active.';
