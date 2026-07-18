# Income Check (Eligibility Decision Support) — Design

Date: 2026-07-18. Status: approved by owner in brainstorming; awaiting Sherlyn's
confirmation on three marked defaults (see "Confirm with Sherlyn").

## Why

Sherlyn (the operator) verifies each applicant's eligibility by hand: household
composition plus income compared against **200% of the Federal Poverty Level**,
which changes every year. The Board requires her to assure only eligible people
receive benefits. Her own caveat, verbatim: applicants "tend to not get correct
income or forget to put all income in" — one applicant reported in-home care as
her good deed but reported no matching income.

So this feature is a **calculator and a flag, not a judge**. It does Sherlyn's
arithmetic and shows its work; she still verifies income and makes every call.

## Non-negotiables (inherited from CLAUDE.md + owner decisions)

- The software **never decides eligibility and never auto-denies**. This
  feature computes an *observation* about **reported** income only.
- The applicant is never blocked, warned, or shown any verdict.
- Flag wording is "appears over the limit — worth a closer look", never
  "ineligible". Every flag shows the full math that produced it.
- No verdict is ever stored in the database; the check is computed at render
  time from stored facts (see Architecture).
- Admin screens: ≥18px type, plain English, CSRF on mutations, `no-store`.
- Applicant form: works with JavaScript disabled; warm, low-reading-level copy.

## Owner decisions (from brainstorming, 2026-07-18)

1. **Behavior:** admin-only flag with full "why" breakdown, plus a gentle
   applicant-form nudge to report all income. No applicant-facing warning.
2. **Upkeep:** Sherlyn edits the yearly dollar limits herself on a plain admin
   screen. Only the dollar figures are editable — which sources count, how they
   annualize, and the 200% multiplier are fixed in code and always displayed.
3. **Entry format:** one dollar field per household size 1–8, plus one
   "each extra person, add" field — mapping 1:1 to the official chart.
4. **Sequencing:** build now with the stated defaults; Sherlyn's answers
   fine-tune later (each is a one-line change).
5. **Architecture:** Approach 1 — per-season limits table + pure function
   computed on view (chosen over settings-row storage and over storing a flag
   at submit time, both of which can go stale or bake verdicts into data).

## Architecture

New migration `0004_income_limits.sql`:

```sql
CREATE TABLE income_limits (
  season_year  INTEGER PRIMARY KEY,      -- one row per season, like everything else
  size_1 INTEGER NOT NULL, size_2 INTEGER NOT NULL, size_3 INTEGER NOT NULL,
  size_4 INTEGER NOT NULL, size_5 INTEGER NOT NULL, size_6 INTEGER NOT NULL,
  size_7 INTEGER NOT NULL, size_8 INTEGER NOT NULL, -- yearly limits, whole dollars
  extra_person INTEGER NOT NULL,          -- add per person above 8
  updated_at   TEXT NOT NULL
);
```

- Seed the current season's row from the latest published 200%-FPL chart.
  **Implementation step: verify the current figures against aspe.hhs.gov at
  build time** — do not trust remembered numbers. The admin screen displays
  whatever is stored, so Sherlyn can verify/correct on day one.
- `tests/helpers/d1.ts` migration loop gains `0004` (as it gained `0003`).
- Season = `new Date().getFullYear()` (existing convention).

### Pure lib — `src/lib/income-check.ts` (TDD)

```ts
export type IncomeLimits = { sizes: number[] /* index 0 = size 1, length 8 */; extraPerson: number };
export type IncomeLine  = { label: string; yearly: number };   // label carries the visible math
export type IncomeCheck = {
  counted: IncomeLine[];      // lines summed into totalYearly
  notCounted: IncomeLine[];   // shown greyed, never summed (FoodShare)
  totalYearly: number;        // whole dollars
  householdSize: number;
  limit: number | null;       // null = no limits row for this season
  overLimit: boolean | null;  // null when limit is null; else totalYearly > limit (strictly)
};
export function limitForSize(size: number, limits: IncomeLimits | null): number | null;
export function checkIncome(app: {
  employers: { employerName: string; workerName: string; hourlyWage: number; hoursPerWeek: number }[];
  benefits: { foodShareAmount: number | null; socialSecurityAmount: number | null;
              ssiAmount: number | null; childSupportAmount: number | null;
              unemploymentWeeklyAmount: number | null; otherIncomeAmount: number | null };
  householdSize: number;
}, limits: IncomeLimits | null): IncomeCheck;
// Lighter entry point for list/export rows, where SQL pre-sums employment:
export function quickIncomeCheck(employmentYearly: number, benefits: /* same */, householdSize: number,
  limits: IncomeLimits | null): { totalYearly: number; limit: number | null; overLimit: boolean | null };
```

Annualization (fixed in code, shown in every line label):

| Source | Rule | Example label |
|---|---|---|
| Each job | `hourlyWage × hoursPerWeek × 52` | `Job — Acme (P): $15.00 × 40 hrs × 52 = $31,200` |
| Social Security, SSI, child support, other income | monthly `× 12` | `Social Security: $800/mo × 12 = $9,600` |
| Unemployment | weekly `× 52` | `Unemployment: $300/wk × 52 = $15,600` |
| FoodShare | **not counted** — listed under `notCounted` | `FoodShare: $400/mo — not counted (food aid, not income)` |

Each line `Math.round`ed to whole dollars; null/absent amounts produce no line.
`limitForSize`: sizes 1–8 read the columns; size > 8 → `size_8 + extra_person × (size − 8)`;
size < 1 or missing limits → null.

### DB layer — `src/lib/db.ts`

- `getIncomeLimits(db, seasonYear): Promise<IncomeLimits | null>`
- `saveIncomeLimits(db, seasonYear, limits): Promise<void>` (upsert, sets `updated_at`)
- List + export queries gain two cheap aggregates per application:
  member count (list may already have it; export does) and
  `(SELECT COALESCE(SUM(e.hourly_wage * e.hours_per_week * 52), 0) FROM employers e
    WHERE e.application_id = a.id) AS employment_yearly`
  so `quickIncomeCheck` runs per row with no extra queries.

## Admin surfaces

### "Income limits" screen — `/admin/income-limits`

Per the approved mockup: heading "Income limits for {year}", subline
"Copy these from the 200% column of the poverty chart", one `$` field per
household size 1–8 + "Each extra person, add", pre-filled from the stored row,
one primary **Save income limits** button. Help text, plain:
"This never denies anyone automatically. These numbers only help you spot
applications to double-check. Update them once a year when the new chart
comes out." Current season only — no year picker.

Validation, forgiving: accept `$`, commas, spaces; require whole positive
numbers; kind field-level errors that never wipe her input. Gentle typo guard:
if any size's limit is lower than the size before it, error
"These numbers usually go up as the household gets bigger — please
double-check household of {n}."

CSRF-protected POST; `no-store` (inherited from admin middleware).
Navigation: one new entry in the shared `AdminNav` ("Income limits") and one
card on the admin home screen.

### Application detail — `[id].astro`

An **"Income check"** box near the income section:

- Every `counted` line with its math, then `Total reported income ≈ $X/year`.
- `Household of N — limit $Y/year`.
- Verdict line, calm not alarming:
  - over: "Reported income appears OVER the limit — worth a closer look."
  - under: "Reported income is under the limit."
  - no limits row: "No income limits entered for {year} yet." + link to the screen.
- `notCounted` lines greyed beneath.
- Standing caveat, always visible: "Based only on what the family reported.
  Income is not verified by this website."

### Applications list + Excel export

- List: a small "Check income" text badge on flagged rows (computed via
  `quickIncomeCheck` from the two new aggregates).
- Export: one new column, plain-English header **"Income check"**, values
  `over limit` / `` (under) / `no limits set`.

## Applicant form — copy only

One warm sentence at the top of the income section of `/apply` (no logic,
no JS, blocks nothing):

> "Please list all money coming into your home — even small or occasional
> amounts like babysitting, odd jobs, or in-home care. Listing everything
> helps us help you faster."

## Confirm with Sherlyn (defaults in effect until she answers)

1. **FoodShare is NOT counted** as income (standard poverty-determination
   practice; it is shown as a visible not-counted line either way).
2. **Household size counts every listed member**, including children who live
   there part of the time.
3. **Annualization** as tabled above (52 weeks, 12 months).

Each is isolated so her correction is a one-line change in
`src/lib/income-check.ts` (plus its test).

## Testing

- `tests/income-check.test.ts` (pure, TDD): each annualization arm; FoodShare
  excluded but listed; multiple jobs summed; null amounts skipped; boundary
  `totalYearly === limit` → **not** over (strictly greater); sizes 1, 8, 9+
  (extra-person math), size beyond chart with null limits; rounding.
- DB round-trip: `saveIncomeLimits`/`getIncomeLimits` upsert + missing-season
  → null; export/list queries return `employment_yearly`.
- Export: "Income check" header + values for an over/under/no-limits fixture.
- Admin screen + detail box: verified by `npm run build` + the shared field
  names pinned by validation tests (house pattern for Astro UI).

## Out of scope

- Auto-deny or any applicant-visible verdict (never).
- Storing the flag in the database.
- Editing prior/future seasons' limits; multi-year history UI.
- Cost-of-living or Alaska/Hawaii chart variants (Wisconsin program).
- Verifying actual income (Sherlyn's job, by design).
