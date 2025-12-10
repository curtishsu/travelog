# Privacy & Guest Mode Specification

## Overview
Certain user-generated content within a trip may be private. This feature introduces:
1. **Lockable text content** at the Trip level and Reflection level.
2. A global **Guest Mode** toggle that masks private content when enabled.
3. A password requirement (Supabase Auth password) to exit Guest Mode.

The goal is to allow users to safely show their travel history to others while hiding private thoughts, journals, photos, and reflections.

---

# Lockable Content Model

## Lockable Content Types
The following **are** considered lockable and will be masked in Guest Mode:
- Trip journal text  
- Trip highlight text  
- Trip long-form text / reflections  
- Reflection entries  
- **All photos** (trip-level or reflection-level)  

## Always Visible (Not Lockable)
These items always remain visible:
- Trip title  
- Trip dates  
- Trip tags  
- Trip locations by day  
- Map locations / pins  
- Trip overview structure (section layout, headers, day indexing)

Trips themselves are **never hidden**; only their private content is masked.

---

# Lock Toggles (Edit Mode Only)

Locking is performed only while in **Edit Mode** and only when **Guest Mode is OFF**.

## Trip-Level Lock
- A **lock icon** appears near the trip header (top-right).
- Default: **Unlocked** (open lock icon).
- Clicking the icon toggles:
  - **Unlocked → Locked** (closed lock icon):  
    `is_trip_content_locked = true`
  - **Locked → Unlocked**:  
    `is_trip_content_locked = false`

Trip-level lock means:
- All trip text and photos are private.
- All reflections behave as private regardless of their individual lock state.

## Reflection-Level Lock
- In Edit Mode, each reflection row/header shows a right-aligned **lock icon**.
- Default: **Unlocked** (open lock icon).
- Clicking toggles:
  - **Unlocked → Locked** (`is_locked = true`)
  - **Locked → Unlocked** (`is_locked = false`)

Reflection-level lock applies only when **the trip itself is not locked**.

---

# Guest Mode

Guest Mode is a **global privacy filter**.

## Entering Guest Mode
- Toggled ON in Settings.
- **No password required.**
- Masks private content throughout the app.
- Guest Mode persists across app restarts.
- Edit Mode is fully disabled.

## Exiting Guest Mode
- Toggled OFF in Settings.
- Requires the user’s **Supabase password**.
- User must be online to verify the password.
- Once authenticated, full content and editing capabilities are restored.

---

# Guest Mode Behavior

## General Rules
When Guest Mode is ON:

### Visible
- Trip title  
- Trip dates  
- Trip tags  
- Trip locations by day  
- Trip structure (sections still appear)

### Masked or Hidden
- **Trip text** → replaced with lock placeholder  
- **Highlights text** → replaced with lock placeholder  
- **All photos** → hidden  
- **Reflections** → do not appear at all  
- **Edit button** → hidden entirely  
- **Delete options** → not shown  

### Deep Linking
If a Guest Mode user navigates manually to a trip or reflection URL:
- Show: title, dates, locations by day  
- Do not show: text, photos, or reflections content  

---

# Trip Detail Page Behavior (Guest Mode)

### Shows:
- Trip title
- Dates
- Tags
- Trip locations by day (e.g., “Day 3 — Cusco”)

### Masks:
- Trip journal
- Highlights
- Trip-level long text
- Photos
- Reflections (removed entirely from the UI)

No editing is available.

---

# Map and Carousel Behavior

## Owner Mode
- Shows full content: titles, highlights, photos, etc.

## Guest Mode
Each carousel item shows only:
- **Location**  
- **Day-of-trip + date** (e.g., `Day 3 · 2025-11-14`)  
- **Lock icon**

No highlight text or photos are shown in Guest Mode.

---

# Editing Restrictions

## Owner Mode
- Edit Mode accessible  
- Trip-level + reflection-level lock toggles available  
- Full editing allowed (text, photos, reflections, tags, etc.)

## Guest Mode
- **Edit button disappears entirely**
- No delete options
- No reorder / add / modify operations
- App is fully read-only

---

# Data Model Recommendation

## Trips Table
is_trip_content_locked boolean NOT NULL DEFAULT false

- When true, entire trip’s content (text + photos + reflections) is masked in Guest Mode.

## Reflections Table


is_locked boolean NOT NULL DEFAULT false

- Applies only when trip is not fully locked.

## Photos
- Inherit lock state from either:
  - Trip-level lock, or
  - Reflection-level lock (if photo is attached to a locked reflection)

## User Settings
- `guest_mode_enabled` boolean stored in `user_settings` (1 row per user)
- Managed on the server so Guest Mode persists and syncs across devices

---

# Lock Precedence Rules

1. **Trip-level lock overrides everything.**  
   If `is_trip_content_locked = true`:
   - All reflections are treated as locked.
   - All photos are masked.
   - No reflection-specific lock state matters.

2. **Reflection-level locks apply only when trip is not locked.**

3. **Non-text metadata (title, dates, tags, locations by day) is always public.**

---

# Summary Flow

## Owner → Guest Mode
- Toggle ON → no password  
- Masks private content  
- Hides reflections  
- Hides editing capabilities  
- Persists across restarts  

## Guest → Owner Mode
- Toggle OFF → requires Supabase Auth password  
- Must be online  
- Unlocks content + restores editing  

---

# End of Spec