# Supabase Setup

1. Install the Supabase CLI: `npm i -g supabase`.
2. Create a Supabase project and note the URL + anon key.
3. Copy `.env.example` to `.env.local` and fill in both public and server-side keys.
4. Start the local stack: `supabase start`.
5. Apply migrations: `supabase db reset`.
6. Create a storage bucket named `trip-photos` with public read disabled.
7. Configure auth email templates as desired.
8. Deploy migrations to remote: `supabase db push`.

