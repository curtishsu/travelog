create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  guest_mode_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_settings enable row level security;

create policy "Users manage their settings"
  on public.user_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger set_user_settings_updated_at
before update on public.user_settings
for each row
execute procedure handle_updated_at();

comment on table public.user_settings is 'Per-user application settings (e.g. guest mode).';



