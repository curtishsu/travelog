# Passport – Machine-Optimized Product & Technical Spec (v1)

> This file is optimized for code generation by an AI coding agent (e.g., GPT-5-codex in Cursor).  
> Style: atomic rules, minimal prose, no placeholders, no rhetorical language.

---

## 0. Context

- App name: `Passport`
- Purpose: personal travel logging and reflection.
- Core goals:
  - Track trips, days, locations, photos, hashtags, trip types.
  - Visualize places visited on globe.
  - Provide stats over time (trips, days, locations, countries, tags, types).

### 0.1 Stack

- Frontend: Next.js 14 (App Router), React.
- Backend: Next.js API routes under `/app/api`.
- DB: Supabase PostgreSQL.
- Auth: Supabase Auth (email + password).
- Storage: Supabase Storage bucket(s) for photos.
- Primary target: mobile web (must also work on desktop web).

---

## 1. Data Model (Canonical)

All tables must include RLS policies so users can only see/modify their own data (based on `auth.uid()`).

### 1.1 `trips`

```sql
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  start_date date not null,          -- inclusive
  end_date date not null,            -- inclusive

  reflection text,                   -- final trip reflection
  status text not null check (status in ('draft', 'active', 'completed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index trips_user_id_name_unique
  on trips (user_id, lower(name));
```

### 1.2 `trip_links`

```sql
create table trip_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  label text not null,       -- e.g. 'itinerary', 'maps'
  url text not null,
  created_at timestamptz not null default now()
);
```

### 1.3 `trip_days`

```sql
create table trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,

  day_index int not null,   -- 1..N
  date date not null,       -- date-only

  highlight text,
  journal_entry text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (trip_id, day_index),
  unique (trip_id, date)
);
```

### 1.4 `trip_locations`

```sql
create table trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references trip_days(id) on delete cascade,

  display_name text not null,  -- e.g. 'Tokyo, Japan'
  city text,
  region text,
  country text,
  lat double precision not null,
  lng double precision not null,

  created_at timestamptz not null default now()
);
```

### 1.5 `photos`

```sql
create table photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  trip_day_id uuid not null references trip_days(id) on delete cascade,
  trip_location_id uuid references trip_locations(id) on delete set null,

  thumbnail_url text not null,
  full_url text not null,
  width int,
  height int,

  created_at timestamptz not null default now()
);
```

### 1.6 `trip_day_hashtags`

```sql
create table trip_day_hashtags (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references trip_days(id) on delete cascade,
  hashtag text not null,          -- lowercase
  created_at timestamptz not null default now(),
  unique (trip_day_id, hashtag)
);
```

### 1.7 `trip_types`

```sql
create table trip_types (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  type text not null,             -- lowercase
  created_at timestamptz not null default now(),
  unique (trip_id, type)
);
```

---

## 2. Global Rules

### 2.1 Dates

- All date fields are `date` type (no time of day).
- Dates must be treated as pure calendar dates (no timezone manipulations).
- `trips.start_date` and `trips.end_date` are inclusive.
- Date format in UI: `Month Day, Year` (e.g., `Sep 5, 2025`).

### 2.2 Trip Date Constraints

- `end_date` must be `>= start_date`.
- Trip duration (`end_date - start_date + 1`) must be `<= 365`.
- `trips.name` must be unique per user (case-insensitive).
- Trip creation and updates must enforce the above constraints.

### 2.3 Status Semantics

- `status` is one of `draft | active | completed`.
- Logical meaning:
  - `draft`: user-created but not necessarily complete; may be upcoming.
  - `active`: today is between `start_date` and `end_date` inclusive.
  - `completed`: today is after `end_date`.
- Implementation may either:
  - Derive status dynamically in app code, or
  - Periodically update `status` column; behavior must be consistent with rules.

---

## 3. Trip/Day/Location Behavior Rules

### 3.1 Trip Creation

- Required fields: `name`, `start_date`, `end_date`.
- On create:
  - Validate `name` uniqueness for `(user_id, lower(name))`.
  - Validate `end_date >= start_date`.
  - Validate duration <= 365.
- If valid:
  - Insert `trips` row (status initially `draft`).
  - Generate `trip_days` rows for each date in `[start_date, end_date]`:
    - `day_index` starts at 1 and increments by 1.
    - `date` equals each calendar date in sequence.

### 3.2 Trip Overlap

- Trips for a user may overlap in dates.
- When creating or updating a trip with overlapping dates:
  - System must detect overlaps with other `trips` of same `user_id`.
  - UI must show a non-blocking warning message.
  - Overlap must not prevent saving.

### 3.3 Trip Date Updates

- When updating `start_date` or `end_date`:
  - If new range extends beyond old range:
    - If new `end_date` > old `end_date`:
      - Append new `trip_days` for each added date at the end.
      - New `day_index` values continue the sequence.
    - If new `start_date` < old `start_date`:
      - Prepend new `trip_days` for each earlier date at the beginning.
      - Existing `day_index` values must be incremented by the number of new prepended days.
  - If new range shrinks (shorter interval):
    - If new range would remove any `trip_days` that contain content (locations, photos, highlight, journal, hashtags):
      - Block the update.
      - UI must display an error indicating that dates cannot be shortened because there is content in removed days.
    - If new range only removes empty days:
      - System may delete those `trip_days`.
- After any date update, there must be exactly one `trip_days` row per date in `[start_date, end_date]` with consistent `day_index`.

### 3.4 TripDays

- Every date in a trip’s date range must have one `trip_days` entry.
- A `trip_days` entry may be completely empty (no locations, no text, no photos).
- Empty `trip_days` still count as travel days for stats.

### 3.5 TripLocations

- Each `trip_locations` row belongs to a single `trip_day`.
- Location creation:
  - User selects via autocomplete (Mapbox or equivalent).
  - Store:
    - `display_name` (string shown to user).
    - `lat`, `lng`.
    - Parsed `city`, `region`, `country` where available.
- A `trip_day` may contain multiple `trip_locations`.
- For stats, a “location” refers to unique city + country combinations.

---

## 4. Photos Rules

- Photos are stored in Supabase Storage; DB stores metadata and URLs.

### 4.1 Upload

- Supported input types: `.heic`, `.jpg`, `.jpeg`, `.png`.
- If `.heic` is not supported by serving layer, convert to a web-friendly format (e.g., `.jpg`) during upload.
- Each upload must generate:
  - A full-size (or medium) image used in fullscreen viewer.
  - A square thumbnail:
    - Cropped from the center.
    - Used in grids/carousels.

### 4.2 Constraints

- Maximum allowed upload size per photo (e.g., 10 MB). This must be enforced in backend or upload logic.
- Photos must be associated to:
  - `trip_id`.
  - `trip_day_id`.
  - Optionally `trip_location_id` (nullable).

### 4.3 Display and Interaction

- In day view and trip detail:
  - Photos appear as square thumbnails, grouped visually (e.g., clusters of 4).
  - Clicking/tapping any thumbnail opens fullscreen viewer.
- Fullscreen viewer:
  - Must support horizontal swipe to view next/previous photos for that day.
  - Should support pinch-to-zoom if feasible (optional but recommended).

### 4.4 Deletion

- Deleting a photo:
  - Must delete DB row (`photos`).
  - Must delete the storage object(s) for thumbnail and full image.
- Deleting a trip:
  - Must delete all photos belonging to that trip and their storage objects.

### 4.5 Performance

- Thumbnails must use lazy loading where possible.
- Large lists of images must avoid loading all full-size images upfront.

---

## 5. Hashtags and Trip Types Rules

### 5.1 Hashtags

- Hashtags are per-`trip_day`.
- Storage:
  - Table `trip_day_hashtags`.
  - `hashtag` stored in lowercase.
  - Unique per `(trip_day_id, hashtag)`.
- Input behavior:
  - User types space-separated tokens in a text input.
  - Each token becomes a hashtag when committed (space, blur, or save).
  - Convert each token to lowercase before persistence.
  - Ignore empty tokens.
- Suggestions:
  - While typing a token, UI must query distinct hashtags used previously by the same user and show suggestions.
  - Selecting a suggestion must only replace the currently edited token, not previous ones.

### 5.2 Trip Types

- Trip types are per-`trip`.
- Storage:
  - Table `trip_types`.
  - `type` stored in lowercase.
- A trip can have multiple types.
- Input:
  - Tag-like input at trip overview level.
  - Convert input to lowercase.
- Suggestions:
  - Based on distinct `type` values used by the same user.
- Display:
  - Types must be displayed as chips on:
    - Trip list cards.
    - Trip detail header.

---

## 6. Status, Drafts, Autosave, Deletion

### 6.1 Drafts

- Trips are created as `draft` by default or when initial data incomplete.
- When editing any trip form (overview/day/reflection):
  - If user navigates away without explicit save, data should be auto-saved when reasonable (e.g. on blur or debounced).
- UI must provide an explicit indication when a trip is still “draft” if desired (e.g., label in Trips list).

### 6.2 Discard Behavior

- Each editing view (overview, day, reflection) must have an `X` (close) control.
- If unsaved changes exist when `X` is clicked:
  - Show modal: “Discard changes?” with buttons:
    - “Yes” → revert to last saved state, then navigate away.
    - “No” → remain on page, no changes lost.
- If user clicks “Save”:
  - After successful persistence, navigation away must not show discard warning for that change set.

### 6.3 Deletion Rules

- Deleting a trip:
  - Must be hard delete.
  - Must remove:
    - `trip_links`.
    - `trip_days`.
    - `trip_locations`.
    - `photos`.
    - `trip_day_hashtags`.
    - `trip_types`.
  - Must show confirmation dialog:
    - Text: “Are you sure you want to delete this trip? This will permanently remove all its data and photos.”
- Deleting a day (as an entity) is not allowed directly; days exist as part of trip date range.
- Day content may be cleared (locations/photos/text/hashtags removed), but `trip_days` row remains and the day still counts as a travel day.

---

## 7. Screens (UI Specification, Concise)

### 7.1 Global Layout

- Global header:
  - Title: `Passport`.
  - Person icon:
    - If user is unauthenticated:
      - On click: fold-out with buttons “Sign in” and “Sign up”.
    - If authenticated:
      - On click: fold-out with entries:
        - Email display.
        - “Profile” (optional).
        - “Settings” (optional).
        - “Log out”.
- Bottom navigation (mobile):
  - Tab 1: `Globe` → Map/Globe view.
  - Tab 2: `Journal` → Trips list.
  - Tab 3: `Add Trip` → Trip editing flow (new or last used).
  - Tab 4: `Stats` → Stats dashboard.

### 7.2 Trips List (Journal)

- Route: `/journal`.
- Shows list of trips for current user, sorted by `start_date` descending (most recent start first).
- For each trip card:
  - Trip name.
  - Date range string.
  - Chips for trip types.
  - Footer text: `X types | Y tags`:
    - `X` = count of distinct `trip_types` rows.
    - `Y` = count of distinct hashtags across all days for that trip (optional).
- On tap/click:
  - Navigate to `/trips/[tripId]` (Trip Detail).

### 7.3 Trip Detail (View Mode)

- Route: `/trips/[tripId]`.
- Header:
  - Trip name.
  - Date range.
  - Trip type chips.
  - Three-dot menu:
    - “Edit trip” → `/trips/[tripId]/edit`.
    - “Delete trip” → triggers confirmation then delete.
- Body:
  - Vertical list of sections, one per `trip_day`, in `day_index` ascending.
  - Per day section:
    - Heading: `Day {day_index} – {date formatted}`.
    - Locations: inline text or chips (e.g. “Tokyo, Japan • Osaka, Japan”).
    - Highlight (if present).
    - Journal entry (if present).
    - Hashtag chips (e.g. `#food #nature #vibes`).
    - Photos:
      - Render as grid or horizontal carousel of square thumbnails.
      - Clicking a thumbnail opens fullscreen viewer scoped to that day’s photos.

### 7.4 Trip Edit (Overview + Days + Reflection)

- Route: `/trips/[tripId]/edit` for edit, and similar for new trip creation (may be `/trips/new`).
- Top horizontal slider / tabs:
  - “Overview”.
  - “Day 1”, “Day 2”, …, “Day N”.
  - “Reflection”.
- Slider is horizontally scrollable when many days exist.
- Active tab controls the content pane below.

#### 7.4.1 Overview Tab

- Fields:
  - Trip name (text input).
  - Start date (date picker).
  - End date (date picker).
  - Links:
    - Repeating rows: label + URL.
    - “Add link” button.
  - Trip types:
    - Tag input:
      - Chips shown for existing trip_types.
      - Text input with suggestions.
- Buttons:
  - “Save”:
    - Creates/updates trip.
    - Triggers `trip_days` generation/update logic.
    - On success, focus should move to “Day 1” tab when creating.
  - “X”:
    - Discard dialog if unsaved changes.

#### 7.4.2 Day Tabs (Day 1…N)

- Content per selected `trip_day`:
  - Location section:
    - List of existing locations:
      - Each row: `display_name` + remove icon.
    - “Add location” button:
      - Opens autocomplete (Mapbox).
      - On selection, creates a `trip_locations` row.
  - Highlight:
    - Single-line text input.
  - Journal entry:
    - Multiline textarea.
  - Photos:
    - Horizontal carousel of tiles:
      - First tile: “+” to add photo(s).
      - Subsequent tiles: thumbnails of `photos` for this day.
      - Each tile has an option to delete the photo.
  - Hashtags:
    - Text input:
      - User types tags separated by spaces.
      - Lowercase normalization.
      - Suggestions dropdown while typing.
- Buttons:
  - “Save day”:
    - Saves edits for current day.
    - On success:
      - If a next day exists, automatically switch to next day tab.
  - “X”:
    - Shows “Discard changes?” if unsaved.

#### 7.4.3 Reflection Tab

- Field:
  - Multiline textarea for overall trip reflection (persisted as `trips.reflection`).
- Button:
  - “Save”:
    - Saves reflection.
    - May navigate back to trip detail or remain on tab.

### 7.5 Map / Globe View

- Route: `/map`.
- UI:
  - Fullscreen 3D globe using Mapbox (or similar).
  - Top toggle:
    - `City` | `Region` | `Country`.
- Data mapping:
  - City view:
    - One pin per unique `(city, country)` encountered in `trip_locations`.
  - Region view:
    - One pin per unique `(region, country)` where `region` is not null.
  - Country view:
    - One pin per unique `country`.
- Initial camera:
  - If user has any locations:
    - Fit camera to bounding box covering all pins (with padding).
  - Else:
    - Center on US.
- Pin interaction:
  - On click/tap:
    - Show a panel (bottom sheet or side panel) with:
      - List of associated `trip_days`, sorted by `date` ascending.
      - For each entry:
        - Trip name.
        - Date.
        - Highlight.
        - Hashtags.
    - On selecting an entry:
      - Navigate to `/trips/[tripId]` and scroll to the corresponding `trip_day` section.

### 7.6 Stats Screen

- Route: `/stats`.
- Layout sections:

1. Summary cards:
   - `Total Trips`.
   - `Total Travel Days`.
   - `Countries Visited`.
   - `Locations Visited`.
   - `Most Visited Location` (full-width card).

2. Distributions:
   - Chart area:
     - Toggle: `Hashtags` vs `Trip Types`.
     - Toggle per chart: `Pie` vs `Bar`.
   - Hashtags chart:
     - Each bar/slice = hashtag.
     - Value = number of days containing that hashtag.
   - Trip types chart:
     - Each bar/slice = trip type.
     - Value = number of trips with that type.

3. Trends:
   - `Trips per Year` (bar or line).
   - `Days Traveled per Year` (bar or line).

- Style:
  - Minimalistic; labels and axes must be readable.

### 7.7 Auth Screens

- `/auth/signin`:
  - Email input.
  - Password input.
  - “Sign in” button.
- `/auth/signup`:
  - Email input.
  - Password input.
  - Confirm password input.
  - “Sign up” button.
- Auth UI may also be displayed in modal or separate layout; spec does not constrain exact design.

---

## 8. User Flows (Stepwise)

### 8.1 Create Trip

1. User taps `Add Trip` bottom nav.
2. App opens trip overview form for a new trip.
3. User enters `name`, `start_date`, `end_date` (and optional links, trip types).
4. User clicks “Save”.
5. Backend:
   - Validates uniqueness of `name` for that user.
   - Validates date constraints.
   - Inserts `trips` row.
   - Generates `trip_days` rows for each date.
6. App navigates to `Day 1` tab in edit view.
7. User fills Day 1 and clicks “Save day”.
8. On success:
   - App switches to Day 2 tab, repeat until last day or user stops.
9. User may fill reflection tab and save.
10. User navigates back to Trip Detail or Trips List.

### 8.2 Edit Trip

1. From Trip Detail, user taps three-dot menu → “Edit trip”.
2. App navigates to `/trips/[tripId]/edit` with Overview tab active.
3. User modifies fields (name, dates, links, types).
4. On “Save”:
   - Backend applies date update logic (extend prepend/append, block shrinking with content).
5. User navigates between day tabs to edit day content.
6. For each day, user saves with “Save day”.
7. User may update reflection and save.
8. On exit:
   - Unsaved changes trigger discard dialog on `X`.

### 8.3 Delete Trip

1. From Trip Detail, user opens three-dot menu → “Delete trip”.
2. Confirmation dialog appears.
3. On confirm:
   - Backend deletes trip and all dependent records.
4. App navigates to Trips List.

### 8.4 View Trip via Map

1. User taps `Globe` tab.
2. Globe loads and displays pins.
3. User taps a pin.
4. Panel lists matching days grouped by trips.
5. User selects a day.
6. App navigates to Trip Detail for that trip and scrolls to the selected day’s section.

---

## 9. Stats Computation (Precise Rules)

Let `today` be current date.

### 9.1 Total Trips

- For user U:
  - `TotalTrips = count(*) from trips where user_id = U.id;`
- Include all statuses.
- Exclude deleted trips (hard delete removes rows).

### 9.2 Total Travel Days

- For user U:
  - Consider all `trip_days` joined to `trips`:
    - Filter: `trips.user_id = U.id`
    - Filter: `trip_days.date <= today`
  - Build a set S of distinct `trip_days.date`.
  - `TotalTravelDays = |S|`.

### 9.3 Countries Visited

- For user U:
  - Join `trip_locations` → `trip_days` → `trips`:
    - `trips.user_id = U.id`
    - `trip_days.date <= today`
  - Extract non-null `country` values.
  - `CountriesVisited = count(distinct country)`.

### 9.4 Locations Visited (City-Level)

- For user U:
  - Same join as above.
  - Build city key `city_key = lower(coalesce(city, '') || '|' || coalesce(country, ''))`.
  - `LocationsVisited = count(distinct city_key)` where `city` or `country` is not null.

### 9.5 Most Visited Location

- For user U:
  - For each distinct city_key:
    - Compute `TripCount(city_key)` = number of distinct `trips.id` where that city appears in `trip_locations` belonging to that trip.
  - Let `MaxTripCount` be maximum `TripCount`.
  - Candidate cities = all city_keys with `TripCount = MaxTripCount`.
  - Tie-break:
    - For each candidate city_key, compute `LatestTripStart(city_key)` = max `trips.start_date` over trips containing that city_key.
    - Choose city_key with greatest `LatestTripStart`.
  - Convert city_key back to human-readable `city, country` for display.

### 9.6 Hashtag Day Distribution

- For user U:
  - Join `trip_day_hashtags` → `trip_days` → `trips`:
    - `trips.user_id = U.id`
    - `trips.end_date < today` (only completed trips).
  - Group by `hashtag`.
  - For each hashtag:
    - `DayCount(hashtag) = count(distinct trip_day_id)`.
- Use `DayCount` values to populate hashtag distribution charts.

### 9.7 Trip Type Distribution

- For user U:
  - Join `trip_types` → `trips`:
    - `trips.user_id = U.id`
    - `trips.end_date < today`.
  - Group by `type`.
  - For each type:
    - `TripCount(type) = count(distinct trip_id)`.

### 9.8 Trips per Year

- For user U:
  - For each trip:
    - `year = extract(year from start_date)`.
  - Group trips by `year`.
  - `TripsPerYear(year) = count(*)`.

### 9.9 Days Traveled per Year

- For user U:
  - Consider all `trip_days` with:
    - `trips.user_id = U.id`
    - `trip_days.date <= today`.
  - Build distinct set of dates `D`.
  - For each date d in D:
    - `y = extract(year from d)`.
  - `DaysPerYear(y) = count(d in D where extract(year from d) = y)`.

---

## 10. API Surface (High-Level)

All routes must validate authenticated user and enforce per-user access.

### 10.1 `/api/trips` (collection)

- `GET`:
  - Return list of trips for current user with minimal fields (id, name, start_date, end_date, status).
- `POST`:
  - Input: trip overview fields (name, start_date, end_date, links, trip_types).
  - Logic: create trip + generate trip_days.
  - Output: created trip with id.

### 10.2 `/api/trips/[tripId]`

- `GET`:
  - Return full trip detail for current user:
    - Trip.
    - trip_links.
    - trip_types.
    - trip_days with:
      - locations.
      - hashtags.
      - photos.
- `PATCH`:
  - Input: updated overview fields (name, dates, links, trip_types, optional reflection).
  - Logic: apply validation + date update behavior.
- `DELETE`:
  - Logic: delete trip and all dependencies.

### 10.3 `/api/trips/[tripId]/days/[dayIndex]`

- `PATCH`:
  - Input:
    - highlight.
    - journal_entry.
    - hashtags (full replacement list).
    - optional location add/remove instructions (or separate endpoints).
  - Logic:
    - Update specified `trip_day`.
    - Sync `trip_day_hashtags` accordingly.

### 10.4 `/api/locations/[locationId]`

- `DELETE`:
  - Delete `trip_locations` row for current user (with ownership check).

### 10.5 `/api/photos` and `/api/photos/[photoId]`

- `POST /api/photos`:
  - Option A: sign URL, client uploads directly to storage, then calls finalize with metadata.
  - Payload must include `trip_id` and `trip_day_id`.
  - Returns DB row + URLs.
- `DELETE /api/photos/[photoId]`:
  - Delete photo DB row and corresponding storage object(s).

### 10.6 `/api/stats`

- `GET`:
  - Returns JSON object with:
    - `totalTrips`
    - `totalTravelDays`
    - `countriesVisited`
    - `locationsVisited`
    - `mostVisitedLocation` (city + country + counts)
    - `hashtagDistribution` (list of `{hashtag, dayCount}`)
    - `tripTypeDistribution` (list of `{type, tripCount}`)
    - `tripsPerYear` (list of `{year, trips}`)
    - `daysPerYear` (list of `{year, days}`)

---

## 11. Suggested Next.js 14 App Structure

```txt
/app
  layout.tsx
  page.tsx               # optional landing (might redirect to /journal)

  /journal
    page.tsx             # trips list

  /trips
    /new
      page.tsx           # create trip (overview + tabs)
    /[tripId]
      page.tsx           # trip detail (view)
      /edit
        page.tsx         # trip edit (overview + days + reflection)

  /map
    page.tsx             # globe/map view

  /stats
    page.tsx             # stats dashboard

  /auth
    /signin
      page.tsx
    /signup
      page.tsx

  /api
    /trips
      route.ts           # GET (list), POST (create)
      /[tripId]
        route.ts         # GET, PATCH, DELETE
        /days
          /[dayIndex]
            route.ts     # PATCH
    /locations
      /[locationId]
        route.ts         # DELETE
    /photos
      route.ts           # POST
      /[photoId]
        route.ts         # DELETE
    /stats
      route.ts           # GET
```

---

## 12. Nonfunctional Requirements (Concise)

- Performance:
  - Use lazy loading for images and large lists.
  - Avoid N+1 queries where possible.
- Security:
  - Enforce Supabase RLS for all tables.
  - All API endpoints must check auth identity and ownership.
- Reliability:
  - Photo uploads must handle failures gracefully (no dangling DB rows with broken URLs).
- UX:
  - All destructive actions must show confirmation dialogs.
  - All save operations must show clear success or error states.
- Responsiveness:
  - Mobile-first layouts; desktop layouts must remain usable.

---

End of spec.
