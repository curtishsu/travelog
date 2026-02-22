# Feature Spec: Story Marking & Stories Carousel

## Overview

This feature allows users to mark specific paragraphs within a day’s journal entry as a **Story**.  
Stories are surfaced in a horizontal carousel at the top of the day view for easy reminiscence.

The system must:

- Preserve freeform journaling.
- Allow lightweight curation of narrative moments.
- Surface Stories without introducing tagging complexity.
- Maintain a minimal, editorial UI.
- Support both mobile and desktop interactions cleanly.

Stories are paragraph-level only and unlimited per day.

---
# 1. Core UX Principle

## Seamless Writing Surface

The journal must **appear as a single continuous writing surface**.

- Users should experience journaling as one flowing document.
- The UI should not expose visible paragraph blocks or segmented text fields.
- There should not be multiple independent input boxes per paragraph.
- Paragraph structure may exist internally, but must not fragment the writing experience visually.

Structured storage is acceptable and expected.  
Fragmented UI is not.
# 1. Goals

- Allow users to mark a paragraph as a Story while writing.
- Surface Stories in a scroll-first horizontal carousel.
- Keep UI minimal (no emoji, no labels, no taxonomy).
- Ensure consistent interaction across mobile and desktop.
- Keep Stories scoped to a single day.

---

# 2. Non-Goals

- No story categories (e.g., funny, highlight, etc.).
- No analytics.
- No keyboard shortcuts.
- No trip-level story aggregation.
- No limits on number of stories.
- No sticky carousel behavior.
- No partial inline story spans (paragraph-only).

---

# 3. Core Behavior

## Paragraph-Level Only

- A Story applies to an entire paragraph.
- Stories cannot span partial text.
- If a selection spans multiple paragraphs, only the paragraph containing the **selection start** is affected.

---

# 4. Story Marking Rules

- Unlimited stories per day.
- Stories are scoped to a single day.
- Story flag persists through edits.
- No auto-removal if paragraph text changes.

### Paragraph Split Behavior

If a Story paragraph is split:
- The first paragraph retains Story status.
- The new paragraph defaults to non-story.

### Paragraph Merge Behavior

If two paragraphs are merged:
- The resulting paragraph is a Story if **either** original paragraph was a Story.

---

# 5. Mobile Interaction

## While Writing

### Tap
- Moves cursor normally.

### Long Press + Drag
- Native text selection (no override).

### Long Press + Release (No Drag)
- Target paragraph is identified.
- Tooltip appears:
  - "Mark as Story"
  - If already Story: "Unmark"
- Tapping elsewhere dismisses tooltip.

### Visual Feedback (Story Paragraph)

- Subtle 2–3px left accent line.
- Very light background tint (3–5%).
- No emoji.
- No labels.
- No badges.

---

# 6. Desktop Interaction

## Trigger: Text Selection

When user selects any text:

- Identify paragraph containing selection start.
- Show floating tooltip above selection:
  - "Mark as Story"
  - If already Story: "Unmark"

If selection spans multiple paragraphs:
- Only affect paragraph containing selection start.

No hover affordances.
No right-click requirement.
No keyboard trigger.

---

# 7. Stories Carousel

## Placement

- Below the trip header (trip name, dates, and tags)
- Above all journal content
- Scrolls away normally with vertical page scroll (not sticky).
- Hidden if zero stories exist.

---

## Layout

### Card Width
- ~88% of container width.
- Next card slightly peeks into view.

### Height
- Auto height.
- Clamp to 3–4 lines.
- Soft fade at bottom if truncated.

---

## Card Content

Primary:
- Story excerpt (visually dominant).

Secondary:
- `Day X · Location` (small, muted text).

No labels.
No emoji.
No icons.

---

# 8. Carousel Behavior

## Primary Interaction (Scroll First)

- Horizontal scroll.
- Snap-to-center.
- Momentum preserved.
- Works with:
  - Swipe (mobile).
  - Trackpad scroll.
  - Shift + mouse wheel.
  - Click-drag (optional).

---

## Tap Assist Navigation

Tap zones on each card:

- Left 25% → Previous story.
- Right 25% → Next story.
- Center 50% → Scroll to paragraph.

Tap must be without drag.

Disabled if only one story exists.

---

## Pagination Dots

- Centered below carousel.
- 6–8px dots.
- Muted inactive state.
- Slightly darker active state.
- Hidden if only one story.

---

# 9. Scroll-to-Paragraph Behavior

When tapping center of a card:

1. Smooth vertical scroll to target paragraph.
2. Paragraph briefly pulses:
   - Slight tint intensification.
   - Accent line temporarily stronger.
3. Returns to normal state.

Paragraphs must have stable DOM anchors to enable scroll targeting.

---

# 10. Empty State Behavior

If no stories exist:
- Hide carousel entirely.
- No persistent instructional UI after first use.

---

# 11. Architectural Decisions (Implemented)

1. **Journal Storage Model**
   - Introduced a normalized table: `trip_day_paragraphs`.
   - Shape:
     - `id` (stable paragraph identifier)
     - `trip_day_id` (FK to `trip_days`)
     - `position` (deterministic ordering per day)
     - `text`
     - `is_story` (paragraph-level Story flag)
     - timestamps (`created_at`, `updated_at`)
   - `trip_days.journal_entry` is retained as a compatibility field and is now derived from paragraph text join (`\n\n` separator).

2. **Migration Strategy**
   - Added migration `20260221000100_trip_day_paragraph_stories.sql`.
   - Backfill strategy:
     - Split existing `trip_days.journal_entry` by paragraph boundaries (`\n\n+`).
     - Insert each paragraph into `trip_day_paragraphs` with increasing `position`.
     - Initialize `is_story = false` for all migrated paragraphs.
   - Preserves all existing journal text and deterministic paragraph order.

3. **Paragraph Identification**
   - Story toggling and scroll targeting use `trip_day_paragraphs.id`.
   - Day view renders each paragraph with a stable DOM anchor derived from paragraph id.
   - Carousel cards reference paragraph ids directly for scroll-to-paragraph behavior.

4. **Selection + Editing Strategy**
   - Editing moved to paragraph blocks in day editor.
   - Story toggling is paragraph-native (no text-span tagging).
   - Split/merge semantics are implemented at editor interaction level:
     - Split (`Enter`): first paragraph keeps Story; new paragraph defaults non-Story.
     - Merge (`Backspace/Delete` across boundary): merged paragraph is Story if either source was Story.

5. **Rendering Strategy**
   - Day view journal renders paragraph blocks with Story visual treatment.
   - Stories carousel is rendered above journal content and hidden when no stories exist.
   - Carousel uses horizontal scroll with snap behavior and tap assist zones:
     - left 25%: previous
     - center 50%: scroll to paragraph
     - right 25%: next
   - Pagination dots reflect active card and are hidden for single-story days.

---

# 12. UX Principles

- Story marking feels like formatting, not tagging.
- Carousel feels like a curated memory reel.
- Interaction is scroll-first, not button-first.
- UI remains minimal and editorial.
- No emoji. No taxonomy. No clutter.

---

**Status: Implemented with paragraph-based storage architecture**