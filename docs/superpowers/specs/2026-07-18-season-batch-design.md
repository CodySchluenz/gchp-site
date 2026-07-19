# Season Batch — Distribution Aids & Applicant Error Visibility — Design

Date: 2026-07-18. Status: approved by owner in brainstorming.

## Why

Sherlyn's full workflow description (relayed 2026-07-18) exposed three gaps in
the freshly shipped features, and the owner's own hands-on test exposed a
fourth on the applicant form:

1. Her distributor Excel "has the extra gift requests on it" (first-come,
   first-get) — our export has no gifts column.
2. She hand-completes ~300 pickup slips with each family's pickup date and
   time. The site prints slips but not dates.
3. She hand-makes color-coded-by-town cards (application number + bag count)
   stapled to each family's boxes and bags.
4. The owner tested the applicant form, left a field blank, and did not
   notice the error banner. Root cause found in the markup: the banner is
   styled identically to the site's ordinary info boxes (white background,
   thin colored left edge — the "two ways to reach us" box uses the same
   treatment). It already counts errors and carries jump links; it just does
   not LOOK like an alarm. Field-level inputs set `aria-invalid` but no CSS
   styles that state.

Owner decisions: build all four. Item 2 must be tableable — implemented
data-driven (below), so it is OFF until Sherlyn assigns days and reversible by
clearing them; no config flag. Item 3 is additive and cheap to delete if she
does not take to it.

## 1. Gift requests in the Excel export

New column **"Gifts requested"** immediately after "People":

- Built in `listApplicationsForExport` with the same GROUP_CONCAT pattern as
  `member_summary`: for members with non-empty `gifts`, `Name: gifts`,
  joined by `; `. Empty string when no one asked for anything.
- `ExportRow` gains `gifts_summary: string`. Header/row arrays stay aligned.

## 2. Pickup days by town → auto-filled slips (data-driven)

### Migration `0008_town_pickup_days.sql`

```sql
ALTER TABLE cities ADD COLUMN pickup_day_id INTEGER;          -- NULL = not set
ALTER TABLE settings ADD COLUMN straggler_pickup_day_id INTEGER; -- NULL = not set
```

Nullable on purpose: **unset means slips print exactly as today.** Sherlyn
turns the feature on by assigning days, and off by clearing them. No code
flag. (SQLite ALTER cannot add a FK constraint; the app treats these as soft
references — a deleted pickup day simply stops matching and the date line
disappears.)

### Admin — Pickup schedule screen gains one section

"Which day does each town pick up?" — a plain list: one row per town
(alphabetical) plus a final "Stragglers" row, each with a dropdown of the
current pickup days ("Not set" first, then each day's date + description) and
one **Save pickup days for towns** button (single form, CSRF). Help copy:
"This fills the pickup date in on each family's printed pickup slip. Leave a
town on 'Not set' and its slips print with a blank date, like before."

### Slips

`listApprovedForSlips` already fetches per-app city; it additionally resolves
each application's assigned day (straggler flag → the straggler day, else the
town's day). `SlipCard` prints one new line when a day is resolved:
**"Pickup: {date_text} — {description}"** — and nothing at all when not set.
Soft-deleted pickup days never match.

## 3. Printable town box cards

New print page `/admin/applications/cards` (admin-only), linked as
**"Print box cards"** next to the existing slips link on the Applications
list. Content: one card per application in the same set slips use (approved,
families + stragglers, never mailed households), ordered by pickup number.

Each card: a thick **color band** (fixed color per town, keyed by city id
from a 23-color print-safe palette; stragglers get black with white text),
the **pickup number very large**, **bag count** ("Bags: 3" or "Bags: ____"
when unset), and the **town name** (or "STRAGGLER"). **No family names** —
boxes sit in a garage; the number is the key, matching her current cards.
Six cards per printed sheet (CSS grid), `print-color-adjust: exact` so bands
actually print, `break-inside: avoid`.

## 4. Applicant form error visibility (`/apply`)

Three reinforcing changes, all working with JavaScript disabled:

1. **Banner treatment**: the existing error banner (count + jump links stays)
   becomes visually unmistakable and unique to errors: solid berry-tinted
   background (`bg-berry-100`-class treatment), a full 2px berry border (not
   just a left edge), and a larger bold heading. Contrast must stay WCAG AA.
2. **Field-level flagging**: global CSS styles the state the server already
   sets — `[aria-invalid="true"]` inputs/selects/textareas get a berry border
   and light berry background tint, so every missed field is visible in
   place while scrolling.
3. **Land on the first problem**: the existing `public/scripts/apply.js`
   gains a few lines — on load, if a field with `aria-invalid="true"` exists,
   focus the first one (browsers scroll to it; its inline message sits right
   there). This is a progressive enhancement: with JavaScript off, the loud
   banner (whose jump links already work without JS) and the red field
   flagging carry the fix on their own. (Server-side `autofocus` was
   considered and rejected: it would require plumbing a prop through four
   shared form components for the same result.)

Nothing typed is ever wiped (unchanged); field names unchanged (validation
tests keep passing); 360px layout unchanged.

## Testing

- Export: gifts column pinned (member with gifts → "Name: gifts" in the row;
  none → '').
- D1: city/straggler day assignment round-trip (set, clear, resolve for a
  town app and a straggler app; unset → null); slips resolution excludes
  soft-deleted days.
- Cards + slips pages: `npm run build` + suite (house pattern for print
  views); the cards page reuses the already-tested slips data set.
- Apply: existing validation tests unchanged and passing; build verifies the
  page; autofocus/banner/CSS are markup-only.

## Addendum (2026-07-19, owner-approved): print granularity

Owner scenario: cards get printed in bulk before packing, then stragglers
arrive — the button only reprints everything. Root gap: the slips and cards
buttons ignore the Show-town dropdown entirely (always whole-season).

1. **Print buttons respect the current view.** The "Print all approved slips"
   and "Print box cards" links carry the list's `town` selection; the slips
   and cards pages parse it (same values as the list: town id / 'mailed' /
   'stragglers' / unset) and filter the already-fetched slips set in-page:
   town id → geographic (`city_id` match — a town's stragglers appear with
   their self-identifying black band and are easily set aside), 'stragglers'
   → `straggler = 1`, unset → everyone (today's behavior). Page headings name
   the view ("Box cards — Platteville — 2026 (12)") so printed stacks are
   identifiable. 'mailed' → no cards/slips; a friendly note explains mailed
   households receive by mail and points at the list view for the mail list.
2. **Single-card route** `/admin/applications/[id]/card` (mirrors the
   existing single-slip route) + a "Print box card" button beside "Print
   pickup slip" on the application page — the one-off answer for a lone late
   approval.
3. **Shared card rendering**: the palette/rank/label logic moves from
   `cards.astro` frontmatter into a pure `src/lib/box-cards.ts`
   (TDD — this also closes the accepted follow-up "no regression test for
   card colors": distinct color per town incl. ids 1 vs 24, straggler black)
   plus a `BoxCard.astro` component used by both the bulk and single pages.
4. **Mailed households**: the "Print pickup slip" and "Print box card"
   buttons are hidden on elderly/disabled applications (a short note shows
   instead — they receive by mail); visiting the routes directly shows the
   same note. Closes the earlier accepted follow-up about the slip button on
   mailed households.
5. Deliberately NOT built: print-history tracking ("only new since last
   print") — site-remembered print state drifts from the physical table the
   first time a printer jams; per-town / per-straggler / per-application
   buttons give exact control with no state.

## Out of scope

- Any change to WHICH families get slips/cards (mailed households stay
  excluded everywhere).
- Editing pickup-day assignments anywhere but the Pickup schedule screen.
- A calendar view of the pickup schedule (assessed separately; declined for
  now — sparse events, free-text dates, 360px).
- Names on box cards (deliberate privacy choice).
- Adoptions, donor letters, referral forms (people-work, not site scope).
