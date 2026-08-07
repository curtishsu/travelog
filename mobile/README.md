# Passport Mobile

This is the Expo React Native mobile app for the Passport project.

The existing Next.js web app remains at:

```text
/Users/curtishsu/Desktop/Passport
```

This Expo app lives at:

```text
/Users/curtishsu/Desktop/Passport/mobile
```

## Run the mobile app

From the mobile app directory:

```bash
cd /Users/curtishsu/Desktop/Passport/mobile
npx expo start
```

Then open the project in Expo Go on iPhone.

## Required environment variables

Add these to your Expo environment before starting the app:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_AUTH_DISABLED
EXPO_PUBLIC_DEMO_EMAIL
EXPO_PUBLIC_DEMO_PASSWORD
EXPO_PUBLIC_MAPBOX_TOKEN
```

Notes:

- `EXPO_PUBLIC_MAPBOX_TOKEN` is needed for location search.
- The mobile app uses direct Supabase auth and reads/writes.
- Compound trip writes are routed through Supabase RPC functions added in the repo migrations.

## Run the web app

From the repository root:

```bash
cd /Users/curtishsu/Desktop/Passport
npm run dev
```

## Scope of this mobile build

- Expo Go-compatible journaling flows first
- Auth, journal list, trip create, trip detail, trip edit, quick add, and basic settings
- Globe, timeline, and stats deferred for later phases
