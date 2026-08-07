# Create the `/Users/curtishsu/Desktop/Passport/mobile` Expo App

## Goal

Create a new Expo React Native app inside this existing repository so we can run an initial mobile version in Expo Go.

This is **not** a conversion of the existing web app. The current Next.js app must remain where it is. The new mobile app must live at:

```text
/Users/curtishsu/Desktop/Passport/mobile
```

The existing web app will continue to run from the repository root.

## Current Repository Shape

At the time of writing, this repository already contains the web app and supporting code at the root, including:

```text
/Users/curtishsu/Desktop/Passport/
  package.json
  package-lock.json
  next.config.mjs
  tsconfig.json
  src/
    app/
    components/
    lib/
    features/
  public/
  supabase/
  docs/
```

Important notes:

- The web app uses `src/app`, not a root-level `app/` directory.
- The existing root app is named `passport` in `package.json`.
- Do not move, rename, or restructure any existing web files.
- Do not convert this repo into a monorepo.
- Do not create `apps/mobile`.
- Do not create `apps/web`.

## Definition of Done

This task is complete when all of the following are true:

### Agent-verifiable

- `/Users/curtishsu/Desktop/Passport/mobile/package.json` exists.
- `/Users/curtishsu/Desktop/Passport/mobile/README.md` exists.
- The generated Expo app exists under `/Users/curtishsu/Desktop/Passport/mobile`.
- Running Expo from `/Users/curtishsu/Desktop/Passport/mobile` starts successfully and shows the local dev server output.
- Running the existing web app from `/Users/curtishsu/Desktop/Passport` still works with `npm run dev`.

### User-verifiable

- The QR code or Expo connection link can be opened in Expo Go.
- The starter Expo app launches on the iPhone.

## What This Task Does Not Include

Do not do any of the following in this task:

- Do not connect Supabase.
- Do not migrate existing Next.js screens into React Native.
- Do not share UI code between web and mobile yet.
- Do not modify the Supabase schema.
- Do not add EAS Build, TestFlight, App Store, or Apple Developer setup.
- Do not add native modules that require leaving Expo Go.
- Do not delete or rename existing root web files.

## Step 1: Start at the Repository Root

Run these commands from the repository root:

```bash
cd /Users/curtishsu/Desktop/Passport
pwd
ls
```

Confirm:

- `pwd` is exactly `/Users/curtishsu/Desktop/Passport`
- `package.json` exists at the root
- `src`, `public`, and `docs` exist at the root

Do not run the Expo creation command from `/Users/curtishsu/Desktop`.

## Step 2: Check Tooling Before Creation

Run:

```bash
node -v
npm -v
```

Confirm that both commands succeed before creating the Expo app.

If either command fails, stop and fix the Node/npm environment first.

## Step 3: Check Whether `mobile/` Already Exists

Run:

```bash
ls mobile
```

Interpret the result as follows:

- If `mobile/` does not exist, continue to Step 4.
- If `mobile/` exists and contains a `package.json`, inspect it before doing anything else. It may already be a valid Expo app.
- If `mobile/` exists but appears incomplete, do **not** delete it automatically.

If `mobile/` already exists, inspect these first:

```bash
ls mobile
sed -n '1,220p' mobile/package.json
```

Only remove `mobile/` if all of the following are true:

- it is clearly a failed generated scaffold,
- it contains no meaningful user-written code,
- and deletion has been explicitly judged safe after inspection.

Default behavior: if unsure, do not delete.

## Step 4: Create the Expo App

From `/Users/curtishsu/Desktop/Passport`, run:

```bash
npx create-expo-app@latest mobile
```

Notes:

- Create the app directly in `mobile/`.
- Do not manually pre-create the `mobile/` folder.
- Let Expo generate the starter files.
- Use the current default Expo starter unless there is a specific reason to change it.
- If the generated template includes Expo Router and an `app/` directory, keep it.
- If the generated template differs from older examples, do not force old file names into place unless needed for startup.

## Step 5: Verify the Generated Files

Run:

```bash
ls mobile
```

At minimum, confirm:

```text
mobile/package.json
mobile/README.md or replaceable starter README
```

Then inspect the generated app entry shape:

```bash
ls mobile/app
```

If `mobile/app` exists, confirm it contains starter route files such as `index` and possibly `_layout`.

If `mobile/app` does not exist, inspect the generated entry files instead and document what Expo created. The important requirement is that the generated app starts successfully in Expo Go, not that it matches an older folder example exactly.

## Step 6: Replace `mobile/README.md`

Replace `mobile/README.md` with the following content:

````md
# Passport Mobile

This is the Expo React Native mobile app for the Passport project.

The existing Next.js web app remains at the repository root:

```text
/Users/curtishsu/Desktop/Passport
```

This mobile app lives separately at:

```text
/Users/curtishsu/Desktop/Passport/mobile
```

## Run the mobile app

From the repository root:

```bash
cd /Users/curtishsu/Desktop/Passport/mobile
npx expo start
```

Then open the project in Expo Go on iPhone.

## Run the web app

From the repository root:

```bash
cd /Users/curtishsu/Desktop/Passport
npm run dev
```

## Notes

- This app is for Expo Go development first.
- It is not an App Store build yet.
- It does not require an Apple Developer account for this stage.
- It is intentionally separate from the existing web app.
- Supabase integration and real app screens will be added later.
- Avoid adding libraries that require a custom native build during this phase.
````

## Step 7: Verify the Mobile App Starts

Run:

```bash
cd /Users/curtishsu/Desktop/Passport/mobile
npx expo start
```

Agent-verifiable success criteria:

- Expo starts without immediate configuration failure.
- The terminal shows the local development server output.
- A QR code, local URL, or Expo connection instructions appear.

If local network discovery is unreliable, try Expo's alternate connection mode supported by the CLI, but do not add native build tooling.

## Step 8: User Device Verification in Expo Go

The user should verify the following on the iPhone:

1. Install Expo Go from the App Store if it is not already installed.
2. Make sure the iPhone and computer are on the same Wi-Fi network.
3. Open the Expo project using the QR code or displayed connection method.
4. Confirm the starter Expo app opens successfully.

If the phone cannot connect over LAN, try the connection fallback mode exposed by Expo before treating the scaffold as failed.

## Step 9: Verify the Existing Web App Still Runs

In a separate terminal, run:

```bash
cd /Users/curtishsu/Desktop/Passport
npm run dev
```

Confirm that the existing Next.js app still starts successfully.

## Output Expectations for the Coding Agent

When the task is complete, report:

- whether `mobile/` was newly created or already existed,
- which Expo starter shape was generated,
- whether `npx expo start` launched successfully,
- whether `npm run dev` at the root still works,
- and which remaining validation step requires the user on the phone.

## Acceptance Criteria

This task is complete when all of the following are true:

```text
/Users/curtishsu/Desktop/Passport/mobile/package.json exists
/Users/curtishsu/Desktop/Passport/mobile/README.md exists
The Expo app was generated under /Users/curtishsu/Desktop/Passport/mobile
cd /Users/curtishsu/Desktop/Passport/mobile && npx expo start starts successfully
cd /Users/curtishsu/Desktop/Passport && npm run dev still works
The user can open the starter app in Expo Go as a final manual verification step
```
