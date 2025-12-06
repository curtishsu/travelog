# Deployment Guide

This document covers the recommended process for deploying Passport to production using Supabase (database, auth, storage) and Vercel (Next.js app hosting).

## 1. Supabase setup

1. Create a new Supabase project and note the **Project URL**, **anon key**, and **service role key**.
2. Clone the project repository locally and install dependencies:
   ```bash
   npm install
   ```
3. Run database migrations from the root of the project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
4. Create a storage bucket named `photos` and mark it as **public**. The photo upload flow expects the following folder structure:
   ```
   photos/{userId}/{tripId}/{tripDayId}/full/<uuid>.<ext>
   photos/{userId}/{tripId}/{tripDayId}/thumb/<uuid>.jpg
   ```
5. (Optional) Enable image resizing on the bucket if you want automatic thumbnail generation. The current implementation produces thumbnails client-side, but resizing can be offloaded to Supabase Edge Functions if desired.

## 2. Environment variables

Create a `.env.local` file for local development and configure the following keys:

```
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

NEXT_PUBLIC_SUPABASE_URL=<project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_MAPBOX_TOKEN=<mapbox-public-token>
MAPBOX_TOKEN=<mapbox-secret-token-or-same-as-public>
```

For production deployments (Vercel), add the same variables to the project settings. **Never expose the service role key to the browser**—it is only used in API routes and runs on the server.

## 3. Mapbox configuration

1. Create a Mapbox account and generate an access token.
2. Add the token to both `NEXT_PUBLIC_MAPBOX_TOKEN` (client-side globe view) and `MAPBOX_TOKEN` if server-side access is also required in the future.
3. Ensure the token has permissions for Maps API usage.

## 4. Deploying to Vercel

1. Push the repository to GitHub (or another Git provider supported by Vercel).
2. In Vercel, **Import Project** and select the repository.
3. Set the environment variables listed above in the Vercel dashboard.
4. Use the default build command (`npm run build`) and output directory (`.next`).
5. Deploy. Subsequent pushes to the configured branches will trigger the CI workflow (`.github/workflows/ci.yml`) and new Vercel deployments.

## 5. Post-deployment checklist

- Confirm that Supabase Row Level Security policies are enabled and that you can create/read/update/delete data only for the authenticated user.
- Test photo uploads and deletions to ensure storage objects are created and removed correctly.
- Visit `/map` and `/stats` to verify Mapbox rendering and stats aggregation.
- Review CI results on GitHub Actions to ensure linting and tests pass before approving pull requests.

