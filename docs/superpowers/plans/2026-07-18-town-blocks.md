# Town-Block Pickup Numbers & Town Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pickup numbers assigned from Sherlyn's town blocks (first applicant = the base number itself), stragglers 2400s, elderly+disabled 2500s (mailed, no slips), operator-editable numbers, and a town dropdown on the applications list and Excel export.

**Architecture:** Migration `0005` adds `cities.block_base` (seeded from her Assigned Numbers doc) and `applications.straggler`; a small pure `src/lib/pickup-numbers.ts` resolves which block an application belongs to; `assignPuNumber` scopes its MAX to the block; `setPuNumber`/`setStraggler` give the operator manual control; list/export/slips queries gain the town/mailed filter and number ordering.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Tailwind 4, Cloudflare D1 (SQLite), Vitest, wrangler 4. Tests `npm test`; build `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-18-town-blocks-design.md` (binding; includes the full block table and Sherlyn's operational rules).

## Global Constraints

- Block rule: first number in a block is the **base itself** (Fennimore's first = 1600). Blocks are 100 wide (base … base+99).
- Precedence: household type elderly or disabled → **2500** (mailed; a late elderly application is NOT a straggler), else straggler → **2400**, else the town's `block_base`. Base 0 (unseeded city) → no auto-assignment.
- Numbers are **never reused** within a season: MAX scans include soft-deleted rows (existing invariant, now per block).
- **Fail-soft, never hard-block:** full block or base 0 → no number assigned, operator types one by hand. Manual entry accepts any positive integer (covers the 2600 program, which gets NO built feature — public or admin — per Sherlyn).
- Never renumber existing applications (2025 imports, already-numbered rows).
- Town filter = geography (`city_id`), so a town view includes mailed residents of that town; "Elderly & disabled (mailed)" = `household_type IN ('elderly','disabled')`. Filtered views order by pickup number; unfiltered stays newest-first.
- Pickup slips exclude `household_type IN ('elderly','disabled')`.
- Near-full warning at ≥90 numbers used in a town's block.
- Admin: ≥18px, plain English, text-labeled buttons, CSRF on every mutating POST, `no-store` via middleware, no inline scripts, kind field-level errors that never wipe input. Straight apostrophes in code copy.
- Copy vocabulary: "Pickup number", "Straggler — applied after their town was packed. Gets a 2400s number and gifts near the end.", "Elderly & disabled (mailed)".

---

## Task 1: Migration 0005, harness, pure pickup-numbers lib

**Files:**
- Create: `migrations/0005_town_blocks.sql`
- Modify: `tests/helpers/d1.ts` (migration loop at :11 AND the cities INSERT at :20)
- Create: `src/lib/pickup-numbers.ts`
- Create: `tests/pickup-numbers.test.ts`
- Modify: `tests/d1-schema.test.ts` (one new case)

**Interfaces:**
- Produces: `cities.block_base INTEGER NOT NULL DEFAULT 0` (seeded), `applications.straggler INTEGER NOT NULL DEFAULT 0`.
- Produces from `src/lib/pickup-numbers.ts` (Tasks 2-4 import these):
  - `STRAGGLER_BASE = 2400`, `MAILED_BASE = 2500`, `BLOCK_SIZE = 100`, `NEAR_FULL_AT = 90`
  - `blockBaseFor(app: { householdType: 'family' | 'elderly' | 'disabled'; straggler: boolean; cityBlockBase: number }): number`
  - `blockRange(base: number): { min: number; max: number }`

- [ ] **Step 1: Write the migration**

Create `migrations/0005_town_blocks.sql` (city ids are from `migrations/0002_seed.sql`; bases from Sherlyn's Assigned Numbers doc):

```sql
-- Town-block pickup numbers (2026-07-18 spec): each town owns a 100-number
-- block; the first applicant from a town gets the base number itself.
-- Category blocks (2400 stragglers, 2500 elderly+disabled) are constants in
-- src/lib/pickup-numbers.ts. Run ONCE against the live DB with
-- `npm run db:migrate:remote`; tests get it via tests/helpers/d1.ts.
ALTER TABLE cities ADD COLUMN block_base INTEGER NOT NULL DEFAULT 0;
UPDATE cities SET block_base = 900  WHERE id = 1;
UPDATE cities SET block_base = 1000 WHERE id = 2;
UPDATE cities SET block_base = 1100 WHERE id = 3;
UPDATE cities SET block_base = 100  WHERE id = 4;
UPDATE cities SET block_base = 2100 WHERE id = 5;
UPDATE cities SET block_base = 1200 WHERE id = 6;
UPDATE cities SET block_base = 300  WHERE id = 7;
UPDATE cities SET block_base = 400  WHERE id = 8;
UPDATE cities SET block_base = 1600 WHERE id = 9;
UPDATE cities SET block_base = 1300 WHERE id = 10;
UPDATE cities SET block_base = 500  WHERE id = 11;
UPDATE cities SET block_base = 600  WHERE id = 12;
UPDATE cities SET block_base = 800  WHERE id = 13;
UPDATE cities SET block_base = 1700 WHERE id = 14;
UPDATE cities SET block_base = 1800 WHERE id = 15;
UPDATE cities SET block_base = 1900 WHERE id = 16;
UPDATE cities SET block_base = 200  WHERE id = 17;
UPDATE cities SET block_base = 1400 WHERE id = 18;
UPDATE cities SET block_base = 1500 WHERE id = 19;
UPDATE cities SET block_base = 700  WHERE id = 20;
UPDATE cities SET block_base = 2000 WHERE id = 22;
UPDATE cities SET block_base = 2200 WHERE id = 23;
UPDATE cities SET block_base = 2300 WHERE id = 24;
ALTER TABLE applications ADD COLUMN straggler INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Update the test harness**

In `tests/helpers/d1.ts`: add `'migrations/0005_town_blocks.sql'` to the file loop (line 11), AND — because the harness inserts its city AFTER migrations run (so the migration's UPDATEs are no-ops in tests) — give the seeded Lancaster row its base (line 20):

```ts
  await db.prepare("INSERT INTO cities (id, name, zip, block_base) VALUES (13, 'Lancaster', '53813', 800)").run();
```

- [ ] **Step 3: Write the failing lib tests**

Create `tests/pickup-numbers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  blockBaseFor, blockRange, STRAGGLER_BASE, MAILED_BASE, BLOCK_SIZE, NEAR_FULL_AT,
} from '../src/lib/pickup-numbers';

describe('blockBaseFor', () => {
  it('family in a town gets the town base', () => {
    expect(blockBaseFor({ householdType: 'family', straggler: false, cityBlockBase: 1600 })).toBe(1600);
  });
  it('elderly go to the mailed block regardless of town', () => {
    expect(blockBaseFor({ householdType: 'elderly', straggler: false, cityBlockBase: 1500 })).toBe(2500);
  });
  it('disabled go to the mailed block too (owner decision 2026-07-18)', () => {
    expect(blockBaseFor({ householdType: 'disabled', straggler: false, cityBlockBase: 800 })).toBe(2500);
  });
  it('a late elderly application is NOT a straggler — mailed wins', () => {
    expect(blockBaseFor({ householdType: 'elderly', straggler: true, cityBlockBase: 800 })).toBe(2500);
  });
  it('family stragglers go to 2400', () => {
    expect(blockBaseFor({ householdType: 'family', straggler: true, cityBlockBase: 100 })).toBe(2400);
  });
  it('an unseeded city (base 0) yields 0 — callers skip auto-assignment', () => {
    expect(blockBaseFor({ householdType: 'family', straggler: false, cityBlockBase: 0 })).toBe(0);
  });
});

describe('blockRange and constants', () => {
  it('a block runs base..base+99', () => {
    expect(blockRange(1600)).toEqual({ min: 1600, max: 1699 });
  });
  it('constants match the spec', () => {
    expect(STRAGGLER_BASE).toBe(2400);
    expect(MAILED_BASE).toBe(2500);
    expect(BLOCK_SIZE).toBe(100);
    expect(NEAR_FULL_AT).toBe(90);
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx vitest run tests/pickup-numbers.test.ts`
Expected: FAIL — cannot resolve `../src/lib/pickup-numbers`.

- [ ] **Step 5: Write the lib**

Create `src/lib/pickup-numbers.ts`:

```ts
// Which pickup-number block an application belongs to. Sherlyn's system
// (see docs/superpowers/specs/2026-07-18-town-blocks-design.md): each town
// owns a 100-number block (cities.block_base, first applicant = the base
// itself); stragglers get the 2400s; elderly and disabled households are
// mailed gift cards — they never go through packing — and get the 2500s.
// The 2600 "Kids without toys" block is deliberately NOT modeled: the
// operator types those few numbers by hand.

export const STRAGGLER_BASE = 2400;
export const MAILED_BASE = 2500; // elderly + disabled: mailed, never packed
export const BLOCK_SIZE = 100;
export const NEAR_FULL_AT = 90; // warn when a town has used this many numbers

export function blockBaseFor(app: {
  householdType: 'family' | 'elderly' | 'disabled';
  straggler: boolean;
  cityBlockBase: number;
}): number {
  // Mailed households outrank straggler status: stragglers are a packing
  // concept, and mailed households never go through packing.
  if (app.householdType === 'elderly' || app.householdType === 'disabled') return MAILED_BASE;
  if (app.straggler) return STRAGGLER_BASE;
  return app.cityBlockBase;
}

export function blockRange(base: number): { min: number; max: number } {
  return { min: base, max: base + BLOCK_SIZE - 1 };
}
```

- [ ] **Step 6: Run the lib tests**

Run: `npx vitest run tests/pickup-numbers.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Add the schema case**

In `tests/d1-schema.test.ts`, add one test in the existing describe (match the file's style for obtaining `db`):

```ts
it('0005 adds cities.block_base and applications.straggler', async () => {
  const city = await db
    .prepare('SELECT block_base FROM cities WHERE id = 13')
    .first<{ block_base: number }>();
  expect(city?.block_base).toBe(800); // harness seeds Lancaster with its base
  const cols = await db.prepare("SELECT name FROM pragma_table_info('applications')").all<{ name: string }>();
  expect(cols.results.map((c) => c.name)).toContain('straggler');
});
```

- [ ] **Step 8: Full suite**

Run: `npm test`
Expected: all pass (nothing consumes the new column yet).

- [ ] **Step 9: Commit**

```bash
git add migrations/0005_town_blocks.sql tests/helpers/d1.ts src/lib/pickup-numbers.ts tests/pickup-numbers.test.ts tests/d1-schema.test.ts
git commit -m "feat(schema): town block_base + straggler flag + pickup-numbers lib"
```

---

## Task 2: DB layer — block-aware assignment, manual numbers, filters, slips

**Files:**
- Modify: `src/lib/db.ts` — `City`/`listCities` (:90-93), `ApplicationListRow`/`listApplications` (:186-240), `assignPuNumber` (:282-301), `ExportRow`/`listApplicationsForExport` (:395-475), `listApprovedForSlips` (:477-530); new `setPuNumber`, `setStraggler`, `countBlockUsage` near `assignPuNumber`.
- Create: `tests/db-pickup-blocks.test.ts`
- Modify (update to block truth): `tests/db-pu.test.ts`, `tests/db-admin-actions.test.ts`, `tests/db-admin-slips.test.ts`; extend `tests/db-admin-list.test.ts`, `tests/db-admin-export.test.ts`.

**Interfaces:**
- Consumes: `blockBaseFor`, `blockRange`, `BLOCK_SIZE` from `src/lib/pickup-numbers.ts` (Task 1).
- Produces (Tasks 3-4 rely on):
  - `assignPuNumber(db, id, seasonYear): Promise<number | null>` (null = nothing assigned: block full or base 0; still idempotent — an existing number is returned as-is)
  - `setPuNumber(db, id, seasonYear, n: number | null): Promise<{ ok: true } | { ok: false; takenBy: number }>`
  - `setStraggler(db, id, on: boolean): Promise<void>`
  - `countBlockUsage(db, seasonYear, base): Promise<number>`
  - `City` gains `block_base: number`; `listCities` selects it.
  - `listApplications(db, seasonYear, status, search, town?: number | 'mailed' | null)`; `ApplicationListRow` gains `address: string; straggler: number; household_type: string`.
  - `listApplicationsForExport(db, seasonYear, status, search, town?: number | 'mailed' | null)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/db-pickup-blocks.test.ts` (fixture: copy the `base: NewApplication` shape from `tests/db-admin-export.test.ts` — cityId 13 = Lancaster, base 800, householdType 'family', seasonYear 2026):

```ts
import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, assignPuNumber, setPuNumber, setStraggler, countBlockUsage,
  softDeleteApplication, listApplications, listApplicationsForExport, listCities,
  setApplicationStatus, listApprovedForSlips, type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('block-aware pickup numbers', () => {
  it('first family in a town gets the base, then base+1; idempotent', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'Second' });
      expect(await assignPuNumber(db, a, 2026)).toBe(800);
      expect(await assignPuNumber(db, b, 2026)).toBe(801);
      expect(await assignPuNumber(db, a, 2026)).toBe(800); // idempotent
    } finally { await dispose(); }
  });

  it('elderly and disabled households go to 2500; straggler families to 2400; late elderly stay 2500', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const eld = await insertApplication(db, { ...base, lastName: 'Eld', householdType: 'elderly', members: [{ ...base.members[0], age: 70 }] });
      const dis = await insertApplication(db, { ...base, lastName: 'Dis', householdType: 'disabled', permanentlyDisabled: true });
      const str = await insertApplication(db, { ...base, lastName: 'Str' });
      const lateEld = await insertApplication(db, { ...base, lastName: 'LateEld', householdType: 'elderly' });
      await setStraggler(db, str, true);
      await setStraggler(db, lateEld, true);
      expect(await assignPuNumber(db, eld, 2026)).toBe(2500);
      expect(await assignPuNumber(db, dis, 2026)).toBe(2501);
      expect(await assignPuNumber(db, str, 2026)).toBe(2400);
      expect(await assignPuNumber(db, lateEld, 2026)).toBe(2502);
    } finally { await dispose(); }
  });

  it('soft-deleted numbers still block reuse within the block', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      await assignPuNumber(db, a, 2026); // 800
      await softDeleteApplication(db, a, '2026-10-02T00:00:00Z');
      expect(await assignPuNumber(db, b, 2026)).toBe(801); // never 800 again
    } finally { await dispose(); }
  });

  it('fail-soft: a full block assigns nothing and returns null', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      const r = await setPuNumber(db, a, 2026, 899); // occupy the block's last number
      expect(r.ok).toBe(true);
      expect(await assignPuNumber(db, b, 2026)).toBeNull();
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((x) => x.last_name === 'B')?.pu_number).toBeNull();
    } finally { await dispose(); }
  });

  it('setPuNumber rejects a duplicate (even a soft-deleted holder) and can clear', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      await setPuNumber(db, a, 2026, 2600); // manual "Kids without toys" number
      await softDeleteApplication(db, a, '2026-10-02T00:00:00Z');
      const dup = await setPuNumber(db, b, 2026, 2600);
      expect(dup.ok).toBe(false);
      if (!dup.ok) expect(dup.takenBy).toBe(a);
      const cleared = await setPuNumber(db, b, 2026, null);
      expect(cleared.ok).toBe(true);
    } finally { await dispose(); }
  });

  it('countBlockUsage counts numbers in the block', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      await assignPuNumber(db, a, 2026);
      await assignPuNumber(db, b, 2026);
      expect(await countBlockUsage(db, 2026, 800)).toBe(2);
      expect(await countBlockUsage(db, 2026, 1500)).toBe(0);
    } finally { await dispose(); }
  });

  it('town and mailed filters, and filtered views order by number', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      const eld = await insertApplication(db, { ...base, lastName: 'Eld', householdType: 'elderly' });
      await assignPuNumber(db, b, 2026);   // 800 (assigned first)
      await assignPuNumber(db, a, 2026);   // 801
      await assignPuNumber(db, eld, 2026); // 2500
      const town = await listApplications(db, 2026, 'all', '', 13);
      expect(town.map((r) => r.last_name)).toEqual(['B', 'Smith', 'Eld']); // geography incl. mailed; number order
      const mailed = await listApplications(db, 2026, 'all', '', 'mailed');
      expect(mailed.map((r) => r.last_name)).toEqual(['Eld']);
      expect(mailed[0].address).toBe('1 Elm'); // mail list carries the address
      const exportTown = await listApplicationsForExport(db, 2026, 'all', '', 13);
      expect(exportTown).toHaveLength(3);
      const exportMailed = await listApplicationsForExport(db, 2026, 'all', '', 'mailed');
      expect(exportMailed).toHaveLength(1);
    } finally { await dispose(); }
  });

  it('pickup slips exclude mailed households', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const fam = await insertApplication(db, base);
      const eld = await insertApplication(db, { ...base, lastName: 'Eld', householdType: 'elderly' });
      await assignPuNumber(db, fam, 2026); await setApplicationStatus(db, fam, 'approved');
      await assignPuNumber(db, eld, 2026); await setApplicationStatus(db, eld, 'approved');
      const slips = await listApprovedForSlips(db, 2026);
      expect(slips.map((s) => s.app.last_name)).toEqual(['Smith']);
    } finally { await dispose(); }
  });

  it('listCities returns block_base', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const cities = await listCities(db);
      expect(cities.find((c) => c.id === 13)?.block_base).toBe(800);
    } finally { await dispose(); }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/db-pickup-blocks.test.ts`
Expected: FAIL — `setPuNumber`/`setStraggler`/`countBlockUsage` not exported; old assign returns 1.

- [ ] **Step 3: Implement in db.ts**

`City` + `listCities` (db.ts:90-93):

```ts
export type City = { id: number; name: string; block_base: number };

export async function listCities(db: D1Database): Promise<City[]> {
  const { results } = await db.prepare('SELECT id, name, block_base FROM cities ORDER BY name').all<City>();
  return results;
}
```

Rework `assignPuNumber` (imports: `import { blockBaseFor, blockRange, BLOCK_SIZE } from './pickup-numbers';`):

```ts
export async function assignPuNumber(db: D1Database, id: number, seasonYear: number): Promise<number | null> {
  const info = await db
    .prepare(
      `SELECT a.household_type, a.straggler, a.pu_number, c.block_base
       FROM applications a JOIN cities c ON c.id = a.city_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<{ household_type: 'family' | 'elderly' | 'disabled'; straggler: number; pu_number: number | null; block_base: number }>();
  if (!info) return null;
  if (info.pu_number != null) return info.pu_number; // idempotent
  const base = blockBaseFor({ householdType: info.household_type, straggler: info.straggler === 1, cityBlockBase: info.block_base });
  if (base <= 0) return null; // unseeded city: operator assigns by hand
  const { min, max } = blockRange(base);
  // Single guarded UPDATE: only fills a NULL pu_number, and only while the
  // next number still fits the block (fail-soft otherwise). The MAX scan has
  // no deleted_at filter on purpose — numbers are never reused, even after a
  // delete + restore (existing invariant, now per block).
  await db
    .prepare(
      `UPDATE applications
         SET pu_number = (SELECT COALESCE(MAX(pu_number) + 1, ?3) FROM applications
                          WHERE season_year = ?1 AND pu_number BETWEEN ?3 AND ?4)
       WHERE id = ?2 AND season_year = ?1 AND pu_number IS NULL
         AND (SELECT COALESCE(MAX(pu_number) + 1, ?3) FROM applications
              WHERE season_year = ?1 AND pu_number BETWEEN ?3 AND ?4) <= ?4`,
    )
    .bind(seasonYear, id, min, max)
    .run();
  const row = await db.prepare('SELECT pu_number FROM applications WHERE id = ?').bind(id).first<{ pu_number: number | null }>();
  return row?.pu_number ?? null;
}

// Manual set (or clear, n = null) for the paper hybrid and odd cases like the
// 2600 numbers. Duplicate check includes soft-deleted rows — never reuse.
export async function setPuNumber(
  db: D1Database, id: number, seasonYear: number, n: number | null,
): Promise<{ ok: true } | { ok: false; takenBy: number }> {
  if (n != null) {
    const clash = await db
      .prepare('SELECT id FROM applications WHERE season_year = ? AND pu_number = ? AND id != ?')
      .bind(seasonYear, n, id)
      .first<{ id: number }>();
    if (clash) return { ok: false, takenBy: clash.id };
  }
  await db.prepare('UPDATE applications SET pu_number = ? WHERE id = ?').bind(n, id).run();
  return { ok: true };
}

export async function setStraggler(db: D1Database, id: number, on: boolean): Promise<void> {
  await db.prepare('UPDATE applications SET straggler = ? WHERE id = ?').bind(on ? 1 : 0, id).run();
}

// How many numbers a block has used this season (soft-deleted rows count).
export async function countBlockUsage(db: D1Database, seasonYear: number, base: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM applications WHERE season_year = ? AND pu_number BETWEEN ? AND ?')
    .bind(seasonYear, base, base + BLOCK_SIZE - 1)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
```

`ApplicationListRow`: add `address: string; straggler: number; household_type: string;`.
Replace the two-branch `listApplications` with one no-op-parameter query (behavior identical when `town` is null; filtered views order by number):

```ts
export async function listApplications(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
  search: string,
  town: number | 'mailed' | null = null,
): Promise<ApplicationListRow[]> {
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const cols = `a.id, a.first_name, a.last_name, a.address, c.name AS city_name, a.submitted_at,
                a.status, a.may_not_be_eligible, a.pu_number, a.straggler, a.household_type,
                a.food_share_amount, a.social_security_amount, a.ssi_amount, a.child_support_amount,
                a.unemployment_weekly_amount, a.other_income_amount,
                (SELECT COUNT(*) FROM household_members m WHERE m.application_id = a.id) AS member_count,
                (SELECT COALESCE(SUM(e.hourly_wage * e.hours_per_week * 52), 0)
                   FROM employers e WHERE e.application_id = a.id) AS employment_yearly`;
  const order = town !== null
    ? 'ORDER BY a.pu_number IS NULL, a.pu_number, a.id'
    : 'ORDER BY a.submitted_at DESC, a.id DESC';
  const { results } = await db
    .prepare(
      `SELECT ${cols} FROM applications a JOIN cities c ON c.id = a.city_id
       WHERE a.deleted_at IS NULL AND a.season_year = ?1
         AND (?2 = '' OR a.status = ?2)
         AND (?3 = '%%' OR lower(a.first_name) LIKE ?3 ESCAPE '\\' OR lower(a.last_name) LIKE ?3 ESCAPE '\\')
         AND (?4 = 0 OR a.city_id = ?4)
         AND (?5 = 0 OR a.household_type IN ('elderly', 'disabled'))
       ${order}`,
    )
    .bind(seasonYear, status === 'all' ? '' : status, like, typeof town === 'number' ? town : 0, town === 'mailed' ? 1 : 0)
    .all<ApplicationListRow>();
  return results;
}
```

`listApplicationsForExport`: same two conditions appended to its WHERE (as `?4`/`?5`, bound the same way), same `town` parameter with default null, and the same conditional ORDER swap (number order when `town !== null`). No column changes.

`listApprovedForSlips`: append `AND a.household_type NOT IN ('elderly', 'disabled')` to the WHERE of ALL THREE queries in the function (apps, cities, members) — mailed households never get slips, and the helper queries should not fetch their rows either.

- [ ] **Step 4: Update the existing tests to block truth**

The Lancaster fixture (cityId 13) now numbers from 800:
- `tests/db-pu.test.ts`: expectations `1, 2, 1` → `800, 801, 800`; the 2025-season case → `800`; the soft-delete high-water case (2027) → first `800`, then `801` after the delete.
- `tests/db-admin-actions.test.ts:26-30`: `1, 2, 1` → `800, 801, 800`; other-season → `800`.
- `tests/db-admin-slips.test.ts`: the `// PU 1` / `// PU 2` comments → 800/801; the sorted-numbers assertion needs no change if it only checks ascending order — verify and adjust only actual values.
- `tests/db-admin-list.test.ts` and `tests/db-admin-export.test.ts`: existing calls keep working (the new parameter defaults to null) — no changes expected; verify.

- [ ] **Step 5: Run everything**

Run: `npx vitest run tests/db-pickup-blocks.test.ts tests/db-pu.test.ts tests/db-admin-actions.test.ts tests/db-admin-slips.test.ts tests/db-admin-list.test.ts tests/db-admin-export.test.ts`, then `npm test`, then `npx tsc --noEmit`
Expected: all pass, tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts tests/db-pickup-blocks.test.ts tests/db-pu.test.ts tests/db-admin-actions.test.ts tests/db-admin-slips.test.ts
git commit -m "feat(db): block-aware pickup numbers, manual set/clear, straggler flag, town/mailed filters, slips exclude mailed"
```

---

## Task 3: Detail page — pickup number box, straggler checkbox, fail-soft banner

**Files:**
- Modify: `src/pages/admin/applications/[id].astro` only (POST handler acts around :29-55; Decision section; banner line :68).

**Interfaces:**
- Consumes: `assignPuNumber` (now `number | null`), `setPuNumber`, `setStraggler` from Task 2.

- [ ] **Step 1: POST handler**

Extend the db import with `setPuNumber, setStraggler`. In the approve branch, use the return value; after the `set_notes` branch add two acts:

```ts
    if (act === 'approve_email' || act === 'approve_silent') {
      const assigned = await assignPuNumber(env.DB, id, season);
      await setApplicationStatus(env.DB, id, 'approved');
      const puFlag = assigned === null ? '&pu=none' : '';
      if (act === 'approve_email') {
        const r = await sendEmail(env, email, renderApprovedEmail(firstName));
        return Astro.redirect(`${detailUrl}?done=approved&mail=${r.sent ? 'ok' : 'fail'}${puFlag}`, 303);
      }
      return Astro.redirect(`${detailUrl}?done=approved${puFlag}`, 303);
    }
```

```ts
    } else if (act === 'set_pu') {
      const raw = String(form.get('pu_number') ?? '').trim();
      if (raw === '') {
        await setPuNumber(env.DB, id, season, null);
        return Astro.redirect(`${detailUrl}?done=pu`, 303);
      }
      if (!/^\d+$/.test(raw)) return Astro.redirect(`${detailUrl}?error=pu_bad`, 303);
      const r = await setPuNumber(env.DB, id, season, Number(raw));
      return Astro.redirect(r.ok ? `${detailUrl}?done=pu` : `${detailUrl}?error=pu_taken&by=${r.takenBy}`, 303);
    } else if (act === 'set_straggler') {
      await setStraggler(env.DB, id, String(form.get('straggler') ?? '') === 'on');
      return Astro.redirect(`${detailUrl}?done=straggler`, 303);
    }
```

- [ ] **Step 2: Banners**

Extend the `banner` expression (line ~68) with the new cases, keeping its style:

```ts
: done === 'pu' ? 'Pickup number saved.'
: done === 'straggler' ? 'Straggler setting saved.'
: flags.get('error') === 'pu_bad' ? 'Please enter a whole number, like 803.'
: flags.get('error') === 'pu_taken' ? `That number is already used by application #${flags.get('by') ?? ''}.`
```

And directly below the banner markup, a one-time note when approve could not assign:

```astro
{new URL(Astro.request.url).searchParams.get('pu') === 'none' && (
  <div class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4" role="status">
    <p class="text-lg font-semibold">No pickup number could be assigned — the town's numbers may be full. Type one in under Decision below.</p>
  </div>
)}
```

(Adapt to how the file actually reads its query flags — it uses a `flags` URLSearchParams-style accessor per line 68; match it.)

- [ ] **Step 3: Decision section UI**

After the approve/deny buttons form inside the Decision section, add:

```astro
        <div class="mt-4 border-t-2 border-stone-200 pt-4">
          <p class="text-lg font-semibold">Pickup number: {a.pu_number ?? 'none yet'}</p>
          <form method="post" class="mt-2 flex flex-wrap items-end gap-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <label class="font-semibold">Change it
              <input type="text" inputmode="numeric" name="pu_number" value={a.pu_number ?? ''}
                class="ml-2 w-32 rounded border-2 border-stone-400 p-2 text-lg" />
            </label>
            <button type="submit" name="act" value="set_pu" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save number</button>
          </form>
          <p class="mt-1 text-stone-600">Leave the box empty and save to remove the number. Numbers follow the town blocks (Lancaster 800s, Platteville 1500s, stragglers 2400s, elderly &amp; disabled 2500s).</p>
          <form method="post" class="mt-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <label class="flex items-start gap-3 text-lg">
              <input type="checkbox" name="straggler" checked={a.straggler === 1} class="mt-1 h-6 w-6" />
              <span>Straggler — applied after their town was packed. Gets a 2400s number and gifts near the end.</span>
            </label>
            <button type="submit" name="act" value="set_straggler" class="mt-2 rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">Save straggler setting</button>
          </form>
        </div>
```

Also update the section's helper line ("Approving assigns the next pickup number for {year}") to: `Approving assigns the next pickup number from this household's block for {a.season_year}.`

- [ ] **Step 4: Verify**

Run: `npm run build`, `npx tsc --noEmit`, `npm test`
Expected: all green (logic is db-tested in Task 2; this is wiring, verified by build per house pattern).

- [ ] **Step 5: Commit**

```bash
git add "src/pages/admin/applications/[id].astro"
git commit -m "feat(admin): editable pickup number + straggler checkbox on detail; fail-soft note when a block is full"
```

---

## Task 4: List + export — town dropdown, mail-list address column, near-full warning

**Files:**
- Modify: `src/pages/admin/applications/index.astro` (frontmatter :1-50; filter row ~:83-100; table)
- Modify: `src/pages/admin/applications/export.xlsx.ts` (params block :7-13)

**Interfaces:**
- Consumes: `listCities` (with `block_base`), `countBlockUsage`, the `town` parameter on both queries (Task 2), `NEAR_FULL_AT`, `BLOCK_SIZE` from `src/lib/pickup-numbers.ts`.

- [ ] **Step 1: index.astro frontmatter**

Extend the db import with `listCities`, and add `import { NEAR_FULL_AT, BLOCK_SIZE } from '../../../lib/pickup-numbers';` plus `countBlockUsage` from db. After the `search` const:

```ts
const townRaw = url.searchParams.get('town') ?? '';
const town: number | 'mailed' | null = townRaw === 'mailed' ? 'mailed' : /^\d+$/.test(townRaw) && Number(townRaw) > 0 ? Number(townRaw) : null;
```

Change the rows call to `listApplications(db, season, status, search, town)`. Add:

```ts
const cities = await listCities(db);
const selectedCity = typeof town === 'number' ? cities.find((c) => c.id === town) ?? null : null;
const blockUsed = selectedCity && selectedCity.block_base > 0
  ? await countBlockUsage(db, season, selectedCity.block_base) : 0;
```

Update `qs` to carry the filter: `const p = new URLSearchParams({ season: String(season), status, q: search, town: townRaw, ...over });` and the export link: `const exportHref = \`/admin/applications/export.xlsx?season=${season}&status=${status}&q=${encodeURIComponent(search)}&town=${townRaw}\`;`

- [ ] **Step 2: The dropdown + warning**

In the filter row (next to the search form), add a small GET form:

```astro
    <form method="get" class="flex items-end gap-2">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="season" value={String(season)} />
      <input type="hidden" name="q" value={search} />
      <label class="font-semibold">Show town
        <select name="town" class="ml-2 rounded border-2 border-stone-400 p-2 text-lg">
          <option value="">All towns</option>
          {cities.map((c) => <option value={String(c.id)} selected={town === c.id}>{c.name}</option>)}
          <option value="mailed" selected={town === 'mailed'}>Elderly &amp; disabled (mailed)</option>
        </select>
      </label>
      <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Show</button>
    </form>
```

Below the income-limits banner, the near-full warning:

```astro
  {selectedCity && blockUsed >= NEAR_FULL_AT && (
    <div class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4" role="status">
      <p class="text-lg font-semibold">{selectedCity.name} has used {blockUsed} of its {BLOCK_SIZE} numbers.
        When they run out, type numbers in by hand on each application.</p>
    </div>
  )}
```

- [ ] **Step 3: Mail-list address column**

In the table, when the mailed view is active, show addresses (her mail list). Header row: after the "Town" header add

```astro
        {town === 'mailed' && <th scope="col" class="border-b-2 border-holly-700 p-3">Address</th>}
```

and the matching body cell after the town cell:

```astro
          {town === 'mailed' && <td class="border-b border-stone-200 p-3">{r.address}</td>}
```

- [ ] **Step 4: export.xlsx.ts**

Parse and pass the same parameter:

```ts
  const townRaw = url.searchParams.get('town') ?? '';
  const town = townRaw === 'mailed' ? ('mailed' as const) : /^\d+$/.test(townRaw) && Number(townRaw) > 0 ? Number(townRaw) : null;
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status, search, town);
```

(Headers/columns unchanged — Address and Town are already in the export.)

- [ ] **Step 5: Verify**

Run: `npm run build`, `npx tsc --noEmit`, `npm test`
Expected: all green (filter/order behavior is db-tested in Task 2).

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/applications/index.astro src/pages/admin/applications/export.xlsx.ts
git commit -m "feat(admin): town dropdown on list + export, mail-list address column, near-full block warning"
```

---

## After all tasks: deployment + operational notes (not code)

- Ship with the held batch: `npm run db:migrate:remote` FIRST (applies 0004 + 0005, both additive), then `npm run build` + `npx wrangler pages deploy dist --project-name gchp-site`. See `docs/go-live-runbook.md` → "Shipping a code update after go-live".
- Existing numbered applications are untouched; only new assignments use blocks.
- The 2026 season's 3 test applications (globally-numbered 1..3) should be deleted by the owner before real applications arrive, so old-style numbers don't sit next to block numbers.
- Tell Sherlyn: numbers now follow her town blocks automatically on Approve; she can change any number by hand; the "Show town" dropdown is her per-town list (sorted by pickup number, printable) and "Elderly & disabled (mailed)" is her mail list with addresses.
