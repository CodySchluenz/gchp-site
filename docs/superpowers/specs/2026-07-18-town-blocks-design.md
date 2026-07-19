# Town-Block Pickup Numbers & Town Filtering — Design

Date: 2026-07-18. Status: approved by owner in brainstorming.
Source of truth: Sherlyn's "Assigned Numbers" doc and "2024 applicants" sheet
(both reviewed in full), plus her messages relayed by the owner on 2026-07-18.

## Why

Sherlyn runs pickup numbers as **town blocks**: each town owns a hundred-number
range, the first applicant from a town gets the base number itself, and the
number follows the family onto packing slips, pickup slips, and gift bags.
Her own records confirm the rule (Blue River's first is 100, Muscoda's 200,
Fennimore's 1600). Sponsors and schools ask "who in our town receives help,"
distributors work from per-town lists, and the county audit uses the same
sheet. The site today assigns one global sequence per season and cannot filter
by town — both must change for the site to become the official record.

## Ground truth from her documents and messages

Town blocks (from the Assigned Numbers doc, seeded verbatim):

| Base | Town | Base | Town |
|---|---|---|---|
| 100 | Blue River | 1300 | Glen Haven |
| 200 | Muscoda | 1400 | Patch Grove |
| 300 | Cuba City | 1500 | Platteville |
| 400 | Dickeyville | 1600 | Fennimore |
| 500 | Hazel Green | 1700 | Livingston |
| 600 | Kieler | 1800 | Montfort |
| 700 | Potosi | 1900 | Mt. Hope |
| 800 | Lancaster | 2000 | Stitzer |
| 900 | Bagley | 2100 | Boscobel |
| 1000 | Beetown | 2200 | Woodman |
| 1100 | Bloomington | 2300 | Prairie du Chien |
| 1200 | Cassville | | |

Category blocks: **2400 Stragglers** (applied after their town's packing was
finished; ~45 in 2024; gifts near the end of the project), **2500 Elderly**
(and disabled — see below; never more than 65 applicants, so the block
suffices), **2600 "Kids without toys"** (new, small — 3 families in 2024 —
and per Sherlyn: NOT on the website).

Her operational rules, verbatim decisions:
- "Elders have to be separate from families. They don't go through packing.
  They receive gift and food cards by mail." → elderly get no pickup slips
  and never appear on packing/distributor lists; they need a mailable list.
- Elderly/disabled definition: 65+ or found disabled by Social Security,
  county resident. Owner decision 2026-07-18: **non-elderly disabled
  households follow the elderly flow** — mailed, numbered in the 2500 block.
- The paper system runs alongside the website (for now); numbers must be
  operator-editable so paper-assigned numbers can be reconciled by hand.
- First number in a block = the base itself (1600, not 1601). Confirmed by
  the 2024 sheet and her Fennimore quote; the "Potosi 701" phrasing was loose.
- 2024 usage: Platteville reached 1543, Lancaster 830 — big towns go deep
  into their blocks, so a near-full warning matters; blocks are conventions,
  not walls.

## Owner decisions (2026-07-18 brainstorming)

1. **Approach:** `block_base` column on the existing `cities` table (one fact
   per town, one source of truth); category bases (2400/2500) as named code
   constants; no separate blocks table, no admin block-editing screen
   (new towns arrive years apart and already require a developer).
2. **Numbers are operator-editable everywhere** (paper hybrid; also quietly
   covers the 2600 program with zero built software — she types 2600 by hand).
3. **Assignment stays hooked to Approve** (as today), now block-aware.
4. Phasing: this spec is #1 of a sequence — #2 is admin paper-application
   entry ("site as official record"), OCR prefill is parked unless the typing
   burden proves real.

## Architecture

### Migration `0005_town_blocks.sql`

```sql
ALTER TABLE cities ADD COLUMN block_base INTEGER NOT NULL DEFAULT 0;
-- 23 UPDATEs, one per seeded city, values from the table above.
ALTER TABLE applications ADD COLUMN straggler INTEGER NOT NULL DEFAULT 0;
```

Test harness (`tests/helpers/d1.ts`) applies `0005` after `0004`, and the
harness's seeded Lancaster row (id 13) gets `block_base = 800`.
Existing pickup numbers (2025 imports, 2026 tests) are never rewritten;
the new logic affects only new assignments.

### Pure lib — `src/lib/pickup-numbers.ts` (TDD)

```ts
export const STRAGGLER_BASE = 2400;
export const MAILED_BASE = 2500;   // elderly + disabled: mailed, never packed
export const BLOCK_SIZE = 100;
export const NEAR_FULL_AT = 90;

export function blockBaseFor(app: {
  householdType: 'family' | 'elderly' | 'disabled';
  straggler: boolean;
  cityBlockBase: number;
}): number;
// Precedence: elderly/disabled -> MAILED_BASE (a late elderly app is NOT a
// straggler; stragglers are a packing concept), then straggler ->
// STRAGGLER_BASE, then the town's base. cityBlockBase 0 (unseeded city) is
// returned as 0 — callers treat it as "no block, leave number unassigned".

export function blockRange(base: number): { min: number; max: number }; // base .. base+99
```

### DB layer (`src/lib/db.ts`)

- `assignPuNumber(db, id, seasonYear)` — reworked: look up the application's
  `household_type`, `straggler`, and city `block_base`; resolve the base via
  `blockBaseFor`; then the same idempotent guarded UPDATE as today but with
  `MAX(pu_number)` scoped to `pu_number BETWEEN base AND base+99` (still
  counting soft-deleted rows — numbers are never reused) and first assignment
  yielding the base itself. **Fail-soft:** if the block is exhausted (next
  would exceed base+99) or base is 0, assign nothing and return null; the UI
  explains and she types a number by hand.
- `setPuNumber(db, id, seasonYear, n: number | null)` — manual set or clear,
  with a season-wide uniqueness check (including soft-deleted rows) that
  reports which application already holds the number.
- `setStraggler(db, id, on: boolean)`.
- `listApplications` + `listApplicationsForExport` gain a town filter param:
  `town: number | 'mailed' | null` — a city id filters by geography
  (`city_id = ?`, includes mailed residents of that town, which is what the
  Platteville school question needs); `'mailed'` filters
  `household_type IN ('elderly','disabled')` (her mail list). When a filter
  is active, order by `pu_number IS NULL, pu_number` (the distributor view);
  the unfiltered list keeps newest-first.
- `listApprovedForSlips` excludes `household_type IN ('elderly','disabled')`
  — mailed households never get pickup slips.
- A small helper returns block usage for the warning: numbers used in a
  town's block for the season.

### Admin UI

- **Detail page, Decision section:** the Approve flow is unchanged (number
  auto-assigned, now block-aware). Below it: a "Pickup number" text box
  showing the current number, editable, with Save (CSRF) — kind errors on
  duplicates ("That number is already used by …"); a note when the block was
  full ("Platteville's numbers are full — type one in by hand."). A
  **Straggler checkbox**: "Straggler — applied after their town was packed.
  Gets a 2400s number and gifts near the end." (Toggling never renumbers an
  already-numbered application; the number box is right there if she wants
  to change it.)
- **Applications list:** a "Show town" dropdown — All towns / each town
  (alphabetical) / "Elderly & disabled (mailed)". Selection flows to the
  Excel download link and the print view (existing print button). With a
  town selected, a near-full banner appears at 90+ used: "Platteville has
  used 92 of its 100 numbers."
- All copy in her vocabulary: "Pickup number", "Straggler",
  "Elderly & disabled (mailed)". Plain English, ≥18px, text buttons, CSRF on
  every mutating POST, `no-store` from middleware, no inline scripts.

## Testing

- Pure lib: precedence (family/elderly/disabled/straggler, late-elderly case,
  base 0), block ranges.
- D1: first assignment = base; second = base+1; elderly and disabled → 2500;
  straggler → 2400; block-full → null + unassigned; soft-deleted numbers still
  block reuse; `setPuNumber` uniqueness (incl. vs soft-deleted) and clear;
  town filter, mailed filter, filtered ordering by number; slips exclude
  mailed households.
- Screens: `npm run build` + full suite green (house pattern).

## Addendum (2026-07-18, owner-approved): Stragglers view

Sherlyn: stragglers "go on a list by themselves." The Show-town dropdown gains
one more option, **"Stragglers"**, after "Elderly & disabled (mailed)":

- Filter = `straggler = 1` (the checkbox is the source of truth, NOT the
  2400s number range — a hand-numbered straggler still appears).
- Flows through exactly like the other options: list, Excel download, print,
  pickup-number ordering, filter preserved across tabs/search/seasons.
- No Address column (stragglers pick up); no near-full banner (not a town).
- `town` param type widens to `number | 'mailed' | 'stragglers' | null` in
  `listApplications` and `listApplicationsForExport`.

## Out of scope (deliberate)

- Anything public or admin-facing for "Kids without toys" (Sherlyn: not on
  the website; manual numbers cover its 3 families a year).
- A block-editing admin screen (developer seeds new towns via migration).
- Pickup dates per town (possible later tie-in with the pickup schedule).
- Her donor-side Excel columns (food cards, gift cards, adopted-by — stays
  her spreadsheet).
- Renumbering existing/imported applications.
- Admin paper-application entry — that is spec #2, next.
- OCR prefill of scanned paper applications — parked; revisit only if
  spec #2's typing burden proves real. (Honest assessment: handwriting OCR
  on these forms would still require field-by-field review and adds a
  privacy/complexity cost the project's goals argue against.)
