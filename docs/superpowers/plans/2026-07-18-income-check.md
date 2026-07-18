# Income Check (200% FPL Decision Support) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Do the operator's income-vs-200%-of-poverty arithmetic per application and flag ones worth a closer look — with the full math shown, admin-editable yearly limits, and a gentle "report all income" nudge on the form. Never decides eligibility, never auto-denies, never stores a verdict.

**Architecture:** Per-season `income_limits` table (migration `0004`); a pure `src/lib/income-check.ts` computed at render time by the admin detail view, list, and Excel export (nothing stored on applications); a plain `/admin/income-limits` screen the operator edits once a year; one copy-only sentence on the applicant form.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Tailwind 4, Cloudflare D1 (SQLite), Vitest, wrangler 4. Tests `npm test`; build `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-18-income-check-design.md` — the binding requirements, including exact flag wording and the three "confirm with Sherlyn" defaults.

## Global Constraints

- The software **never decides eligibility and never auto-denies**. The check is an observation about **reported** income only; the applicant is never blocked, warned, or shown any verdict.
- Flag wording exactly: "Reported income appears OVER the limit — worth a closer look." / "Reported income is under the limit." Never the word "ineligible".
- Standing caveat wherever the check renders: "Based only on what the family reported. Income is not verified by this website."
- No verdict stored in the database — computed at render time, always against the **application's own `season_year`**.
- `overLimit` uses **strictly greater** (`total > limit`); exactly-at-limit is NOT over.
- Annualization fixed in code and visible in every line label: wages `× hoursPerWeek × 52`; Social Security / SSI / child support / other income `× 12`; unemployment `× 52`; **FoodShare never counted** but always listed as a greyed not-counted line.
- Household size = all listed members, including part-time children.
- Admin screens: ≥18px type, plain English, text-labeled buttons, CSRF on every mutating POST, `Cache-Control: no-store` (inherited from admin middleware). Applicant form works with JavaScript disabled; validation errors never wipe typed values.
- Straight apostrophes only in code copy. No inline scripts/handlers (CSP).
- Whole dollars everywhere: `Math.round` per line; limits are positive integers.
- Season convention: `new Date().getFullYear()` (house pattern).

---

## Task 1: Migration 0004, harness, pure income-check lib

**Files:**
- Create: `migrations/0004_income_limits.sql`
- Modify: `tests/helpers/d1.ts:11` (migration loop)
- Create: `src/lib/income-check.ts`
- Create: `tests/income-check.test.ts`
- Modify: `tests/d1-schema.test.ts` (one new case)

**Interfaces:**
- Produces: table `income_limits(season_year PK, size_1..size_8, extra_person, updated_at)` seeded with the 2026 row.
- Produces from `src/lib/income-check.ts` (Tasks 2, 4, 5 import these):
  - `type IncomeLimits = { sizes: number[]; extraPerson: number }` (index 0 = household of 1 … index 7 = household of 8)
  - `type IncomeLine = { label: string; yearly: number }`
  - `type IncomeCheck = { counted: IncomeLine[]; notCounted: IncomeLine[]; totalYearly: number; householdSize: number; limit: number | null; overLimit: boolean | null }`
  - `type BenefitAmounts = { foodShareAmount: number | null; socialSecurityAmount: number | null; ssiAmount: number | null; childSupportAmount: number | null; unemploymentWeeklyAmount: number | null; otherIncomeAmount: number | null }`
  - `type EmployerLine = { employerName: string; workerName: string; hourlyWage: number; hoursPerWeek: number }`
  - `limitForSize(size: number, limits: IncomeLimits | null): number | null`
  - `checkIncome(app: { employers: EmployerLine[]; benefits: BenefitAmounts; householdSize: number }, limits: IncomeLimits | null): IncomeCheck`
  - `quickIncomeCheck(employmentYearly: number, benefits: BenefitAmounts, householdSize: number, limits: IncomeLimits | null): { totalYearly: number; limit: number | null; overLimit: boolean | null }`

- [ ] **Step 1: Write the migration**

Create `migrations/0004_income_limits.sql`:

```sql
-- Income check (2026-07-18 spec): per-season yearly income limits (200% of the
-- HHS poverty guidelines), edited by the operator at /admin/income-limits.
-- Run ONCE against the live DB with `npm run db:migrate:remote`. Fresh DBs
-- (tests) get this via tests/helpers/d1.ts, which applies it after 0003.
CREATE TABLE income_limits (
  season_year INTEGER PRIMARY KEY,
  size_1 INTEGER NOT NULL,
  size_2 INTEGER NOT NULL,
  size_3 INTEGER NOT NULL,
  size_4 INTEGER NOT NULL,
  size_5 INTEGER NOT NULL,
  size_6 INTEGER NOT NULL,
  size_7 INTEGER NOT NULL,
  size_8 INTEGER NOT NULL,
  extra_person INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
-- Seed: 200% of the 2026 HHS poverty guidelines (aspe.hhs.gov, published
-- 2026-01-13, 48 contiguous states: $15,960 for 1, +$5,680 each additional).
-- The admin screen displays these for the operator to verify and correct.
INSERT INTO income_limits (season_year, size_1, size_2, size_3, size_4, size_5, size_6, size_7, size_8, extra_person, updated_at)
VALUES (2026, 31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440, 11360, '2026-07-18T00:00:00Z');
```

- [ ] **Step 2: Add 0004 to the test harness**

In `tests/helpers/d1.ts` line 11, extend the file list:

```ts
  for (const file of ['migrations/0001_init.sql', 'migrations/0003_relationships.sql', 'migrations/0004_income_limits.sql']) {
```

(No other harness change; the loop already strips `--` comment lines.)

- [ ] **Step 3: Write the failing tests for the lib**

Create `tests/income-check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  limitForSize, checkIncome, quickIncomeCheck,
  type IncomeLimits, type BenefitAmounts,
} from '../src/lib/income-check';

// 200% of the 2026 chart — same values migration 0004 seeds.
const LIMITS_2026: IncomeLimits = {
  sizes: [31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440],
  extraPerson: 11360,
};

const NO_BENEFITS: BenefitAmounts = {
  foodShareAmount: null, socialSecurityAmount: null, ssiAmount: null,
  childSupportAmount: null, unemploymentWeeklyAmount: null, otherIncomeAmount: null,
};

describe('limitForSize', () => {
  it('reads sizes 1 and 8 from the chart', () => {
    expect(limitForSize(1, LIMITS_2026)).toBe(31920);
    expect(limitForSize(8, LIMITS_2026)).toBe(111440);
  });
  it('adds extra_person for each person above 8', () => {
    expect(limitForSize(9, LIMITS_2026)).toBe(111440 + 11360);
    expect(limitForSize(11, LIMITS_2026)).toBe(111440 + 3 * 11360);
  });
  it('clamps size below 1 up to household of 1', () => {
    expect(limitForSize(0, LIMITS_2026)).toBe(31920);
  });
  it('returns null when no limits exist for the season', () => {
    expect(limitForSize(4, null)).toBeNull();
  });
});

describe('checkIncome', () => {
  it('annualizes each job at wage x hours x 52 and shows the math in the label', () => {
    const r = checkIncome({
      employers: [{ employerName: 'Acme', workerName: 'Pat', hourlyWage: 15.5, hoursPerWeek: 40 }],
      benefits: NO_BENEFITS, householdSize: 2,
    }, LIMITS_2026);
    expect(r.counted).toHaveLength(1);
    expect(r.counted[0].yearly).toBe(32240); // 15.50 * 40 * 52
    expect(r.counted[0].label).toContain('Acme');
    expect(r.counted[0].label).toContain('52');
    expect(r.totalYearly).toBe(32240);
  });
  it('sums multiple jobs', () => {
    const r = checkIncome({
      employers: [
        { employerName: 'Acme', workerName: 'Pat', hourlyWage: 10, hoursPerWeek: 20 },
        { employerName: 'Kwik Trip', workerName: 'Sam', hourlyWage: 12, hoursPerWeek: 10 },
      ],
      benefits: NO_BENEFITS, householdSize: 3,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(10 * 20 * 52 + 12 * 10 * 52);
  });
  it('annualizes monthly benefits x12 and weekly unemployment x52', () => {
    const r = checkIncome({
      employers: [],
      benefits: { ...NO_BENEFITS, socialSecurityAmount: 800, ssiAmount: 500, childSupportAmount: 200, otherIncomeAmount: 50, unemploymentWeeklyAmount: 300 },
      householdSize: 2,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(800 * 12 + 500 * 12 + 200 * 12 + 50 * 12 + 300 * 52);
    expect(r.counted.map((l) => l.label).join(' ')).toContain('Social Security');
  });
  it('lists FoodShare as not counted and excludes it from the total', () => {
    const r = checkIncome({
      employers: [], benefits: { ...NO_BENEFITS, foodShareAmount: 400 }, householdSize: 2,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(0);
    expect(r.counted).toHaveLength(0);
    expect(r.notCounted).toHaveLength(1);
    expect(r.notCounted[0].label).toContain('not counted');
  });
  it('skips null amounts entirely (no line)', () => {
    const r = checkIncome({ employers: [], benefits: NO_BENEFITS, householdSize: 1 }, LIMITS_2026);
    expect(r.counted).toHaveLength(0);
    expect(r.notCounted).toHaveLength(0);
    expect(r.totalYearly).toBe(0);
    expect(r.overLimit).toBe(false);
  });
  it('is NOT over when total equals the limit exactly (strictly greater)', () => {
    // household of 1, limit 31920: one job at exactly 31920/year = $15.346.. impossible;
    // use SSI 2660/mo x 12 = 31920 exactly.
    const r = checkIncome({
      employers: [], benefits: { ...NO_BENEFITS, ssiAmount: 2660 }, householdSize: 1,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(31920);
    expect(r.overLimit).toBe(false);
  });
  it('flags over when one dollar past the limit', () => {
    const r = checkIncome({
      employers: [], benefits: { ...NO_BENEFITS, otherIncomeAmount: 2661 }, householdSize: 1,
    }, LIMITS_2026); // 2661 * 12 = 31932 > 31920
    expect(r.overLimit).toBe(true);
  });
  it('returns null limit and null overLimit when the season has no limits row', () => {
    const r = checkIncome({ employers: [], benefits: NO_BENEFITS, householdSize: 4 }, null);
    expect(r.limit).toBeNull();
    expect(r.overLimit).toBeNull();
  });
  it('rounds each line to whole dollars', () => {
    const r = checkIncome({
      employers: [{ employerName: 'A', workerName: 'B', hourlyWage: 7.33, hoursPerWeek: 3 }],
      benefits: NO_BENEFITS, householdSize: 1,
    }, LIMITS_2026);
    expect(Number.isInteger(r.counted[0].yearly)).toBe(true);
    expect(r.counted[0].yearly).toBe(Math.round(7.33 * 3 * 52));
  });
});

describe('quickIncomeCheck', () => {
  it('matches checkIncome for the same inputs', () => {
    const benefits = { ...NO_BENEFITS, socialSecurityAmount: 800 };
    const full = checkIncome({
      employers: [{ employerName: 'Acme', workerName: 'Pat', hourlyWage: 15, hoursPerWeek: 40 }],
      benefits, householdSize: 3,
    }, LIMITS_2026);
    const quick = quickIncomeCheck(15 * 40 * 52, benefits, 3, LIMITS_2026);
    expect(quick.totalYearly).toBe(full.totalYearly);
    expect(quick.limit).toBe(full.limit);
    expect(quick.overLimit).toBe(full.overLimit);
  });
  it('handles missing limits', () => {
    expect(quickIncomeCheck(50000, NO_BENEFITS, 2, null).overLimit).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run tests/income-check.test.ts`
Expected: FAIL — cannot resolve `../src/lib/income-check`.

- [ ] **Step 5: Write the lib**

Create `src/lib/income-check.ts`:

```ts
// Income check: does the operator's 200%-of-poverty arithmetic and shows its
// work. Decision support ONLY (owner decision, 2026-07-18 spec): the result is
// an observation about REPORTED income, never an eligibility decision, and it
// is never stored — always recomputed from the application and that season's
// limits (income_limits table, edited at /admin/income-limits).
//
// Defaults awaiting Sherlyn's confirmation (see the 2026-07-18 spec):
//   1. FoodShare is NOT counted (food aid, not income) — shown as a
//      not-counted line so she always sees it.
//   2. Household size counts every listed member, including part-time children.
//   3. Wages annualize x52 weeks; monthly benefits x12; weekly unemployment x52.

export type IncomeLimits = {
  sizes: number[]; // index 0 = household of 1 ... index 7 = household of 8
  extraPerson: number; // add this much for each person above 8
};

export type IncomeLine = { label: string; yearly: number };

export type IncomeCheck = {
  counted: IncomeLine[]; // these sum to totalYearly
  notCounted: IncomeLine[]; // shown greyed, never summed (FoodShare)
  totalYearly: number;
  householdSize: number;
  limit: number | null; // null = no limits row for this season
  overLimit: boolean | null; // null when limit is null; else strictly greater
};

export type BenefitAmounts = {
  foodShareAmount: number | null;
  socialSecurityAmount: number | null;
  ssiAmount: number | null;
  childSupportAmount: number | null;
  unemploymentWeeklyAmount: number | null;
  otherIncomeAmount: number | null;
};

export type EmployerLine = {
  employerName: string;
  workerName: string;
  hourlyWage: number;
  hoursPerWeek: number;
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export function limitForSize(size: number, limits: IncomeLimits | null): number | null {
  if (!limits) return null;
  const n = Math.max(1, Math.floor(size)); // a household is always at least the applicant
  if (n <= 8) return limits.sizes[n - 1] ?? null;
  return limits.sizes[7] + limits.extraPerson * (n - 8);
}

function benefitLines(b: BenefitAmounts): { counted: IncomeLine[]; notCounted: IncomeLine[] } {
  const counted: IncomeLine[] = [];
  const notCounted: IncomeLine[] = [];
  const monthly: [string, number | null][] = [
    ['Social Security', b.socialSecurityAmount],
    ['SSI', b.ssiAmount],
    ['Child support', b.childSupportAmount],
    ['Other income', b.otherIncomeAmount],
  ];
  for (const [label, amt] of monthly) {
    if (amt != null) {
      counted.push({ label: `${label}: ${money(amt)}/month x 12 = ${money(amt * 12)}`, yearly: Math.round(amt * 12) });
    }
  }
  if (b.unemploymentWeeklyAmount != null) {
    const a = b.unemploymentWeeklyAmount;
    counted.push({ label: `Unemployment: ${money(a)}/week x 52 = ${money(a * 52)}`, yearly: Math.round(a * 52) });
  }
  if (b.foodShareAmount != null) {
    notCounted.push({
      label: `FoodShare: ${money(b.foodShareAmount)}/month — not counted (food aid, not income)`,
      yearly: 0,
    });
  }
  return { counted, notCounted };
}

export function checkIncome(
  app: { employers: EmployerLine[]; benefits: BenefitAmounts; householdSize: number },
  limits: IncomeLimits | null,
): IncomeCheck {
  const jobLines: IncomeLine[] = app.employers.map((e) => ({
    label: `Job — ${e.employerName} (${e.workerName}): $${e.hourlyWage.toFixed(2)} x ${e.hoursPerWeek} hrs x 52 = ${money(e.hourlyWage * e.hoursPerWeek * 52)}`,
    yearly: Math.round(e.hourlyWage * e.hoursPerWeek * 52),
  }));
  const b = benefitLines(app.benefits);
  const counted = [...jobLines, ...b.counted];
  const totalYearly = counted.reduce((sum, l) => sum + l.yearly, 0);
  const limit = limitForSize(app.householdSize, limits);
  return {
    counted,
    notCounted: b.notCounted,
    totalYearly,
    householdSize: app.householdSize,
    limit,
    overLimit: limit === null ? null : totalYearly > limit,
  };
}

// For list rows and the export, where SQL pre-sums employment
// (SUM(hourly_wage * hours_per_week * 52)) and no line labels are needed.
export function quickIncomeCheck(
  employmentYearly: number,
  benefits: BenefitAmounts,
  householdSize: number,
  limits: IncomeLimits | null,
): { totalYearly: number; limit: number | null; overLimit: boolean | null } {
  const b = benefitLines(benefits);
  const totalYearly = Math.round(employmentYearly) + b.counted.reduce((sum, l) => sum + l.yearly, 0);
  const limit = limitForSize(householdSize, limits);
  return { totalYearly, limit, overLimit: limit === null ? null : totalYearly > limit };
}
```

- [ ] **Step 6: Run the lib tests**

Run: `npx vitest run tests/income-check.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 7: Add the schema case**

In `tests/d1-schema.test.ts`, add one test inside the existing describe (follow the file's existing style for getting `db`):

```ts
it('income_limits table exists with the 2026 seed row', async () => {
  const row = await db
    .prepare('SELECT size_1, size_8, extra_person FROM income_limits WHERE season_year = 2026')
    .first<{ size_1: number; size_8: number; extra_person: number }>();
  expect(row?.size_1).toBe(31920);
  expect(row?.size_8).toBe(111440);
  expect(row?.extra_person).toBe(11360);
});
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: all pass (harness now applies 0004 everywhere; watch for any test that assumed the exact table list).

- [ ] **Step 9: Commit**

```bash
git add migrations/0004_income_limits.sql tests/helpers/d1.ts src/lib/income-check.ts tests/income-check.test.ts tests/d1-schema.test.ts
git commit -m "feat(schema): income_limits table + pure income-check lib (200% FPL decision support)"
```

---

## Task 2: DB layer — limits round-trip + list/export aggregates

**Files:**
- Modify: `src/lib/db.ts` (new functions near `getSettings`; `ApplicationListRow` + `listApplications` at :142-188; `ExportRow` + `listApplicationsForExport` at :343-419)
- Create: `tests/db-income-limits.test.ts`
- Modify: `tests/db-admin-list.test.ts`, `tests/db-admin-export.test.ts` (one assertion each)

**Interfaces:**
- Consumes: `IncomeLimits` from `src/lib/income-check.ts` (Task 1).
- Produces (Tasks 3-5 rely on these):
  - `getIncomeLimits(db: D1Database, seasonYear: number): Promise<IncomeLimits | null>`
  - `saveIncomeLimits(db: D1Database, seasonYear: number, limits: IncomeLimits): Promise<void>` (upsert)
  - `ApplicationListRow` gains: `member_count: number; employment_yearly: number; food_share_amount: number | null; social_security_amount: number | null; ssi_amount: number | null; child_support_amount: number | null; unemployment_weekly_amount: number | null; other_income_amount: number | null`
  - `ExportRow` gains: `employment_yearly: number`

- [ ] **Step 1: Write the failing tests**

Create `tests/db-income-limits.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { getIncomeLimits, saveIncomeLimits } from '../src/lib/db';

describe('income limits round-trip', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('reads the seeded 2026 row', async () => {
    const l = await getIncomeLimits(db, 2026);
    expect(l?.sizes).toEqual([31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440]);
    expect(l?.extraPerson).toBe(11360);
  });

  it('returns null for a season with no row', async () => {
    expect(await getIncomeLimits(db, 2031)).toBeNull();
  });

  it('inserts a new season and updates an existing one (upsert)', async () => {
    await saveIncomeLimits(db, 2027, { sizes: [1, 2, 3, 4, 5, 6, 7, 8], extraPerson: 9 });
    expect((await getIncomeLimits(db, 2027))?.sizes[0]).toBe(1);
    await saveIncomeLimits(db, 2027, { sizes: [11, 12, 13, 14, 15, 16, 17, 18], extraPerson: 19 });
    const updated = await getIncomeLimits(db, 2027);
    expect(updated?.sizes[7]).toBe(18);
    expect(updated?.extraPerson).toBe(19);
  });
});
```

In `tests/db-admin-list.test.ts`, add to an existing case (after inserting an application with the file's fixture — it has members and may have employers; assert against whatever that fixture contains):

```ts
const row = rows[0];
expect(row.member_count).toBeGreaterThan(0);
expect(typeof row.employment_yearly).toBe('number');
expect('ssi_amount' in row).toBe(true);
```

In `tests/db-admin-export.test.ts`, inside the existing `'includes the new columns and per-application aggregates'` case (its fixture has one employer: Acme, $15/hr, 40 hrs):

```ts
expect(r.employment_yearly).toBe(15 * 40 * 52);
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/db-income-limits.test.ts tests/db-admin-list.test.ts tests/db-admin-export.test.ts`
Expected: FAIL — `getIncomeLimits` not exported; missing row fields.

- [ ] **Step 3: Implement in db.ts**

Add near the settings functions (top of file, after `getSettings`):

```ts
import type { IncomeLimits } from './income-check'; // add to the file's imports

// Yearly income limits (200% of poverty), one row per season. Null = the
// operator has not entered limits for that season yet — callers show a
// "no limits entered" state, never a guess.
export async function getIncomeLimits(db: D1Database, seasonYear: number): Promise<IncomeLimits | null> {
  const row = await db
    .prepare(
      'SELECT size_1, size_2, size_3, size_4, size_5, size_6, size_7, size_8, extra_person FROM income_limits WHERE season_year = ?',
    )
    .bind(seasonYear)
    .first<{
      size_1: number; size_2: number; size_3: number; size_4: number;
      size_5: number; size_6: number; size_7: number; size_8: number;
      extra_person: number;
    }>();
  if (!row) return null;
  return {
    sizes: [row.size_1, row.size_2, row.size_3, row.size_4, row.size_5, row.size_6, row.size_7, row.size_8],
    extraPerson: row.extra_person,
  };
}

export async function saveIncomeLimits(db: D1Database, seasonYear: number, limits: IncomeLimits): Promise<void> {
  await db
    .prepare(
      `INSERT INTO income_limits (season_year, size_1, size_2, size_3, size_4, size_5, size_6, size_7, size_8, extra_person, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(season_year) DO UPDATE SET
         size_1 = excluded.size_1, size_2 = excluded.size_2, size_3 = excluded.size_3,
         size_4 = excluded.size_4, size_5 = excluded.size_5, size_6 = excluded.size_6,
         size_7 = excluded.size_7, size_8 = excluded.size_8,
         extra_person = excluded.extra_person, updated_at = excluded.updated_at`,
    )
    .bind(seasonYear, ...limits.sizes, limits.extraPerson, new Date().toISOString())
    .run();
}
```

Extend `ApplicationListRow` (db.ts:142) with the eight fields listed in Interfaces above, and extend the `cols` string in `listApplications` (db.ts:165):

```ts
  const cols = `a.id, a.first_name, a.last_name, c.name AS city_name, a.submitted_at,
                a.status, a.may_not_be_eligible, a.pu_number,
                a.food_share_amount, a.social_security_amount, a.ssi_amount, a.child_support_amount,
                a.unemployment_weekly_amount, a.other_income_amount,
                (SELECT COUNT(*) FROM household_members m WHERE m.application_id = a.id) AS member_count,
                (SELECT COALESCE(SUM(e.hourly_wage * e.hours_per_week * 52), 0)
                   FROM employers e WHERE e.application_id = a.id) AS employment_yearly`;
```

In `listApplicationsForExport` (db.ts:383), add `employment_yearly: number;` to `ExportRow` and one line to the SELECT, next to the existing `employment_summary` subquery (db.ts:408):

```sql
           (SELECT COALESCE(SUM(e.hourly_wage * e.hours_per_week * 52), 0)
              FROM employers e WHERE e.application_id = a.id) AS employment_yearly,
```

- [ ] **Step 4: Run the three test files**

Run: `npx vitest run tests/db-income-limits.test.ts tests/db-admin-list.test.ts tests/db-admin-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test` then `npx tsc --noEmit`
Expected: all pass, tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts tests/db-income-limits.test.ts tests/db-admin-list.test.ts tests/db-admin-export.test.ts
git commit -m "feat(db): income-limits round-trip + employment/member aggregates for list and export"
```

---

## Task 3: Limits validation + the /admin/income-limits screen

**Files:**
- Create: `src/lib/validation/income-limits.ts`
- Create: `tests/income-limits-validation.test.ts`
- Create: `src/pages/admin/income-limits/index.astro`
- Modify: `src/components/admin/AdminNav.astro:4-12` (one entry)
- Modify: `src/components/admin/AdminHome.astro:50-75` (one card)

**Interfaces:**
- Consumes: `IncomeLimits` (Task 1); `getIncomeLimits`/`saveIncomeLimits` (Task 2); `verifyCsrf`/`csrfTokenFor`/`newCsrfCookieValue` from `src/lib/csrf` (existing — use exactly as `src/pages/admin/pickup/index.astro:8,13-15,59-62` does).
- Produces: `validateIncomeLimits(input: Record<string, string>): { ok: true; limits: IncomeLimits } | { ok: false; errors: Record<string, string> }` and `LIMIT_FIELDS` from `src/lib/validation/income-limits.ts`.

- [ ] **Step 1: Write the failing validation tests**

Create `tests/income-limits-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateIncomeLimits, LIMIT_FIELDS } from '../src/lib/validation/income-limits';

const good: Record<string, string> = {
  size_1: '31920', size_2: '43280', size_3: '54640', size_4: '66000',
  size_5: '77360', size_6: '88720', size_7: '100080', size_8: '111440',
  extra_person: '11360',
};

describe('validateIncomeLimits', () => {
  it('accepts plain whole numbers', () => {
    const r = validateIncomeLimits(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limits.sizes).toEqual([31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440]);
      expect(r.limits.extraPerson).toBe(11360);
    }
  });
  it('forgives dollar signs, commas, and spaces', () => {
    const r = validateIncomeLimits({ ...good, size_1: '$31,920', size_2: ' 43 280 ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.limits.sizes[0]).toBe(31920);
  });
  it('rejects blanks with a kind message on the right field', () => {
    const r = validateIncomeLimits({ ...good, size_3: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.size_3).toContain('fill in');
  });
  it('rejects non-numbers and decimals', () => {
    const r = validateIncomeLimits({ ...good, size_5: 'abc', extra_person: '11360.50' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.size_5).toBeTruthy();
      expect(r.errors.extra_person).toBeTruthy();
    }
  });
  it('rejects zero', () => {
    const r = validateIncomeLimits({ ...good, size_1: '0' });
    expect(r.ok).toBe(false);
  });
  it('flags a limit lower than the size before it (typo guard)', () => {
    const r = validateIncomeLimits({ ...good, size_4: '5000' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.size_4).toContain('double-check');
  });
  it('LIMIT_FIELDS lists the nine form fields in order', () => {
    expect(LIMIT_FIELDS).toEqual([
      'size_1', 'size_2', 'size_3', 'size_4', 'size_5', 'size_6', 'size_7', 'size_8', 'extra_person',
    ]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/income-limits-validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validation**

Create `src/lib/validation/income-limits.ts`:

```ts
// Forgiving parsing for the operator's yearly income-limit form. She copies
// numbers from the printed 200%-of-poverty chart, so accept "$31,920",
// "31 920", or "31920" — whole positive dollars only. Errors are kind,
// field-specific, and never wipe what she typed (the page re-renders values).
import type { IncomeLimits } from '../income-check';

export const LIMIT_FIELDS = [
  'size_1', 'size_2', 'size_3', 'size_4', 'size_5', 'size_6', 'size_7', 'size_8', 'extra_person',
] as const;

export function validateIncomeLimits(
  input: Record<string, string>,
): { ok: true; limits: IncomeLimits } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const parsed: Record<string, number> = {};
  for (const f of LIMIT_FIELDS) {
    const raw = (input[f] ?? '').replace(/[$,\s]/g, '');
    if (raw === '') {
      errors[f] = 'Please fill in this amount.';
      continue;
    }
    if (!/^\d+$/.test(raw)) {
      errors[f] = 'Please enter a whole dollar amount, like 31920.';
      continue;
    }
    const n = Number(raw);
    if (n <= 0 || n > 10_000_000) {
      errors[f] = "That number doesn't look right — please double-check the chart.";
      continue;
    }
    parsed[f] = n;
  }
  // Typo guard: the chart always goes up with household size.
  if (Object.keys(errors).length === 0) {
    for (let i = 2; i <= 8; i++) {
      if (parsed[`size_${i}`] < parsed[`size_${i - 1}`]) {
        errors[`size_${i}`] =
          `These numbers usually go up as the household gets bigger — please double-check household of ${i}.`;
      }
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    limits: {
      sizes: LIMIT_FIELDS.slice(0, 8).map((f) => parsed[f]),
      extraPerson: parsed.extra_person,
    },
  };
}
```

- [ ] **Step 4: Run the validation tests**

Run: `npx vitest run tests/income-limits-validation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Build the screen**

Create `src/pages/admin/income-limits/index.astro`. Mirror the pickup screen's CSRF/redirect/banner pattern (`src/pages/admin/pickup/index.astro`), but on validation errors re-render with the operator's values preserved (never wipe her input):

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import { getIncomeLimits, saveIncomeLimits } from '../../../lib/db';
import { validateIncomeLimits, LIMIT_FIELDS } from '../../../lib/validation/income-limits';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const season = new Date().getFullYear();

let values: Record<string, string> = {};
let errors: Record<string, string> = {};

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect('/admin/income-limits?error=csrf', 303);
  for (const f of LIMIT_FIELDS) values[f] = String(form.get(f) ?? '');
  const result = validateIncomeLimits(values);
  if (result.ok) {
    await saveIncomeLimits(env.DB, season, result.limits);
    return Astro.redirect('/admin/income-limits?saved=1', 303);
  }
  errors = result.errors;
} else {
  const existing = await getIncomeLimits(env.DB, season);
  if (existing) {
    existing.sizes.forEach((n, i) => { values[`size_${i + 1}`] = String(n); });
    values.extra_person = String(existing.extraPerson);
  }
}

const url = new URL(Astro.request.url);
const banner = url.searchParams.get('saved') === '1' ? 'Income limits saved.'
  : url.searchParams.get('error') === 'csrf' ? "That didn't save — please try again." : '';

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);

const rows: { name: string; label: string }[] = [
  { name: 'size_1', label: 'Household of 1' },
  { name: 'size_2', label: 'Household of 2' },
  { name: 'size_3', label: 'Household of 3' },
  { name: 'size_4', label: 'Household of 4' },
  { name: 'size_5', label: 'Household of 5' },
  { name: 'size_6', label: 'Household of 6' },
  { name: 'size_7', label: 'Household of 7' },
  { name: 'size_8', label: 'Household of 8' },
  { name: 'extra_person', label: 'Each extra person, add' },
];
---
<Admin title="Income limits" heading={`Income limits for ${season}`} back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">
    Help: copy these from the 200% column of the poverty chart you use. This never denies anyone
    automatically — these numbers only help you spot applications to double-check. Update them once
    a year when the new chart comes out.
  </p>

  {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}

  <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
    <form method="post" class="space-y-3">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {rows.map((r) => (
        <label class="flex flex-wrap items-center gap-3 font-semibold">
          <span class="w-56">{r.label}</span>
          <span class="text-lg">$</span>
          <input type="text" inputmode="numeric" name={r.name} value={values[r.name] ?? ''}
            aria-invalid={errors[r.name] ? 'true' : undefined}
            class="w-40 rounded border-2 border-stone-400 bg-white p-3 text-lg" />
          {errors[r.name] && <span class="w-full font-semibold text-berry-800">{errors[r.name]}</span>}
        </label>
      ))}
      <button type="submit" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">
        Save income limits
      </button>
    </form>
  </section>

  <p class="mt-4 text-lg text-stone-600">
    Yearly amounts, before taxes. The official chart is published each January
    (search for "poverty guidelines" on aspe.hhs.gov).
  </p>
</Admin>
```

- [ ] **Step 6: Add navigation**

In `src/components/admin/AdminNav.astro`, add after the `'Paper application'` entry:

```ts
  { href: '/admin/income-limits', label: 'Income limits' },
```

In `src/components/admin/AdminHome.astro`, add a card to the grid (after the Paper application card, before Donors):

```astro
        <a href="/admin/income-limits" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Income limits</span>
          <span class="mt-1 block text-lg text-stone-700">Enter this year's income limits from the poverty chart.</span>
        </a>
```

- [ ] **Step 7: Build + full suite**

Run: `npm run build` then `npm test`
Expected: build completes; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/validation/income-limits.ts tests/income-limits-validation.test.ts "src/pages/admin/income-limits/index.astro" src/components/admin/AdminNav.astro src/components/admin/AdminHome.astro
git commit -m "feat(admin): Income limits screen — operator edits the yearly 200% FPL chart"
```

---

## Task 4: Income check box on the application detail page

**Files:**
- Modify: `src/pages/admin/applications/[id].astro` (frontmatter imports + compute; new section after the Income section, which ends at :139)

**Interfaces:**
- Consumes: `checkIncome` (Task 1), `getIncomeLimits` (Task 2), the existing `detail = await getApplicationDetail(...)` object (`detail.employers` and `detail.members` are snake_case DB rows; `a` is the application row).
- Produces: nothing new for later tasks (Task 5 uses `quickIncomeCheck` independently).

- [ ] **Step 1: Frontmatter — compute the check**

In `[id].astro` frontmatter, add to the existing db import: `getIncomeLimits`. Add:

```ts
import { checkIncome } from '../../../lib/income-check';
```

After `detail`/`a` are loaded, add:

```ts
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const incomeLimits = await getIncomeLimits(env.DB, Number(a.season_year));
const income = checkIncome(
  {
    employers: detail.employers.map((e) => ({
      employerName: String(e.employer_name),
      workerName: String(e.worker_name),
      hourlyWage: Number(e.hourly_wage),
      hoursPerWeek: Number(e.hours_per_week),
    })),
    benefits: {
      foodShareAmount: num(a.food_share_amount),
      socialSecurityAmount: num(a.social_security_amount),
      ssiAmount: num(a.ssi_amount),
      childSupportAmount: num(a.child_support_amount),
      unemploymentWeeklyAmount: num(a.unemployment_weekly_amount),
      otherIncomeAmount: num(a.other_income_amount),
    },
    householdSize: detail.members.length,
  },
  incomeLimits,
);
const dollars = (n: number) => '$' + n.toLocaleString('en-US');
```

- [ ] **Step 2: Template — the Income check section**

Insert directly after the Income section's closing `</section>` (currently line 139), before the Good deed section:

```astro
      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Income check</h2>
        {income.limit === null ? (
          <p class="mt-2 text-lg">
            No income limits entered for {a.season_year} yet.
            <a href="/admin/income-limits" class="font-semibold text-berry-700 underline">Enter this year's income limits</a>
          </p>
        ) : (
          <>
            {income.counted.length === 0
              ? <p class="mt-2 text-lg">No income was reported.</p>
              : <ul class="mt-2 list-disc pl-6 text-lg">{income.counted.map((l) => <li>{l.label}</li>)}</ul>}
            <p class="mt-3 text-lg font-bold">Total reported income: about {dollars(income.totalYearly)} a year</p>
            <p class="text-lg">Household of {income.householdSize} — this year's limit is {dollars(income.limit)}</p>
            {income.overLimit ? (
              <p class="mt-2 rounded border-l-4 border-gold-500 bg-holly-100 p-3 text-lg font-bold">
                Reported income appears OVER the limit — worth a closer look.
              </p>
            ) : (
              <p class="mt-2 text-lg font-semibold text-holly-800">Reported income is under the limit.</p>
            )}
          </>
        )}
        {income.notCounted.length > 0 && (
          <ul class="mt-2 pl-6 text-stone-600">{income.notCounted.map((l) => <li>{l.label}</li>)}</ul>
        )}
        <p class="mt-3 text-stone-600">Based only on what the family reported. Income is not verified by this website.</p>
      </section>
```

- [ ] **Step 3: Build + typecheck + full suite**

Run: `npm run build`, `npx tsc --noEmit`, `npm test`
Expected: all green. The box's logic is already covered by `tests/income-check.test.ts`; this step wires data.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/admin/applications/[id].astro"
git commit -m "feat(admin): Income check box on application detail — full math, flag wording, caveat"
```

---

## Task 5: List badge, export column, applicant nudge

**Files:**
- Modify: `src/pages/admin/applications/index.astro` (frontmatter + table at :98-121)
- Modify: `src/pages/admin/applications/export.xlsx.ts` (headers at :18-22, rows at :23-28)
- Modify: `src/pages/apply.astro` (one paragraph after the "Work and income" heading at :320)
- Modify: `tests/db-admin-export.test.ts` (route-level mapping is pinned via the db values; add the flag-value expectations here)

**Interfaces:**
- Consumes: `quickIncomeCheck`, `type BenefitAmounts` (Task 1); `getIncomeLimits` (Task 2); the widened `ApplicationListRow` / `ExportRow` (Task 2).

- [ ] **Step 1: List page — badge + no-limits banner**

In `src/pages/admin/applications/index.astro` frontmatter, extend the db import with `getIncomeLimits` and add:

```ts
import { quickIncomeCheck, type BenefitAmounts } from '../../../lib/income-check';
```

After `rows` is loaded:

```ts
const incomeLimits = await getIncomeLimits(db, season);
const rowBenefits = (r: ApplicationListRow): BenefitAmounts => ({
  foodShareAmount: r.food_share_amount,
  socialSecurityAmount: r.social_security_amount,
  ssiAmount: r.ssi_amount,
  childSupportAmount: r.child_support_amount,
  unemploymentWeeklyAmount: r.unemployment_weekly_amount,
  otherIncomeAmount: r.other_income_amount,
});
const overLimit = (r: ApplicationListRow): boolean =>
  quickIncomeCheck(r.employment_yearly, rowBenefits(r), r.member_count, incomeLimits).overLimit === true;
```

Above the table, after the existing banners:

```astro
  {incomeLimits === null && (
    <div class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4" role="status">
      <p class="text-lg">No income limits entered for {season} yet.
        <a href="/admin/income-limits" class="font-semibold text-berry-700 underline">Enter this year's income limits</a>
        to see income flags here.</p>
    </div>
  )}
```

In the table: add a header cell after "PU #" (line 105):

```astro
        <th scope="col" class="border-b-2 border-holly-700 p-3">Income check</th>
```

and the matching body cell after the PU # cell (line 121):

```astro
          <td class="border-b border-stone-200 p-3 font-semibold text-berry-800">{overLimit(r) ? 'Check income' : ''}</td>
```

- [ ] **Step 2: Export — the "Income check" column**

In `src/pages/admin/applications/export.xlsx.ts`, import `getIncomeLimits` alongside `listApplicationsForExport`, and:

```ts
import { quickIncomeCheck, type BenefitAmounts } from '../../../lib/income-check';
```

After `rows` is fetched:

```ts
  const limits = await getIncomeLimits(locals.runtime.env.DB, season);
  const incomeFlag = (r: (typeof rows)[number]): string => {
    const benefits: BenefitAmounts = {
      foodShareAmount: r.food_share_amount, socialSecurityAmount: r.social_security_amount,
      ssiAmount: r.ssi_amount, childSupportAmount: r.child_support_amount,
      unemploymentWeeklyAmount: r.unemployment_weekly_amount, otherIncomeAmount: r.other_income_amount,
    };
    const q = quickIncomeCheck(r.employment_yearly, benefits, r.member_count, limits);
    return q.overLimit === null ? 'no limits set' : q.overLimit ? 'over limit' : '';
  };
```

In `headers`, insert `'Income check'` after `'Jobs'`; in the row mapping, insert `incomeFlag(r)` after `r.employment_summary` (same position).

- [ ] **Step 3: Pin the flag values in the export test**

In `tests/db-admin-export.test.ts`, add one test (own `getTestDb()` in try/finally, per the file's pattern). The 2026 seed limits exist in every test DB, so build one clearly-over application and one clearly-under:

```ts
  it('provides what the income-check flag needs, over and under', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await insertApplication(db, {
        ...base, lastName: 'Overby',
        employers: [{ employerName: 'BigCo', workerName: 'P', hourlyWage: 50, hoursPerWeek: 40 }],
      }); // 50*40*52 = 104,000 > 42,300-ish limit for household of 2
      await insertApplication(db, { ...base, lastName: 'Underby' });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      const over = rows.find((r) => r.last_name === 'Overby')!;
      const under = rows.find((r) => r.last_name === 'Underby')!;
      const { quickIncomeCheck } = await import('../src/lib/income-check');
      const { getIncomeLimits } = await import('../src/lib/db');
      const limits = await getIncomeLimits(db, 2026);
      const bens = (r: typeof over) => ({
        foodShareAmount: r.food_share_amount, socialSecurityAmount: r.social_security_amount,
        ssiAmount: r.ssi_amount, childSupportAmount: r.child_support_amount,
        unemploymentWeeklyAmount: r.unemployment_weekly_amount, otherIncomeAmount: r.other_income_amount,
      });
      expect(quickIncomeCheck(over.employment_yearly, bens(over), over.member_count, limits).overLimit).toBe(true);
      expect(quickIncomeCheck(under.employment_yearly, bens(under), under.member_count, limits).overLimit).toBe(false);
    } finally { await dispose(); }
  });
```

- [ ] **Step 4: Applicant nudge (copy only)**

In `src/pages/apply.astro`, directly after the "Work and income" `<h2>` (line 320) and before the existing "Please list every job..." paragraph, insert:

```astro
          <p class="mt-2">Please list all money coming into your home — even small or occasional amounts like babysitting, odd jobs, or in-home care. Listing everything helps us help you faster.</p>
```

(No logic, no JS, nothing conditional — works identically with JavaScript off.)

- [ ] **Step 5: Run everything**

Run: `npx vitest run tests/db-admin-export.test.ts`, then `npm test`, `npx tsc --noEmit`, `npm run build`
Expected: all pass, tsc exit 0, build completes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/applications/index.astro src/pages/admin/applications/export.xlsx.ts src/pages/apply.astro tests/db-admin-export.test.ts
git commit -m "feat: income-check badge on the list, Income check export column, report-all-income nudge on the form"
```

---

## After all tasks: deployment + follow-up notes (not code)

- Live deploy is deliberately held until closer to Oct 1 (owner decision 2026-07-17). When shipping: `npm run db:migrate:remote` FIRST (applies 0004; additive), then `npm run build` + `npx wrangler pages deploy dist --project-name gchp-site`. See `docs/go-live-runbook.md` → "Shipping a code update after go-live."
- Confirm with Sherlyn (defaults active meanwhile): FoodShare not counted; part-time children count toward household size; annualization x52/x12. Each is a one-line change in `src/lib/income-check.ts` + its test.
- The seeded 2026 numbers are 200% of the published 2026 HHS guidelines (verified against aspe.hhs.gov on 2026-07-18). Sherlyn should still eyeball them on the new screen against her own chart.
