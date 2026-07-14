# Plan 3c — Finish the Applications Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring post-submission editing of an application to full parity with the paper form (edit every field; add/remove household members and employers) and clear the applications-workflow polish items carried in `docs/decisions.md`.

**Architecture:** Reuse the Plan 3b news/pickup editor pattern — a per-row `<form>` + a separate "Add" form + server round-trips that redirect with a banner (Post/Redirect/Get), no JavaScript required, CSP-safe, `data-confirm` for destructive actions. The application detail page gains three plain buttons linking to section editors: "Edit details" (extended single form), "Edit household members", and "Edit jobs". New D1 helpers do child edits/deletes scoped by `application_id` so a crafted id cannot touch another record.

**Tech Stack:** Astro 5 (server output, `@astrojs/cloudflare`), Cloudflare D1 (SQLite), Cloudflare R2, Tailwind 4, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-14-plan-3c-application-editing-design.md`

## Global Constraints

- **CSP is `script-src 'self'`.** No inline event handlers, no inline `<script>`. All JS lives in external files; `public/scripts/print-button.js` provides print + `data-confirm`. Every page that needs confirm/print loads it via `<script src="/scripts/print-button.js" defer></script>`.
- **Every mutating admin POST enforces CSRF** via `verifyCsrf(env.CSRF_SECRET, cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''))`. Mint the token on GET with the standard 5-line cookie block.
- **Operator usability:** admin base font ≥18px (the `Admin` layout body is `text-lg`; buttons inherit); text-labeled buttons (never icon-only); plain English; one clear primary action per screen; obvious Back on every screen; confirm before destructive actions.
- **Straight apostrophes only** (`'`) in code-authored copy. Never curly (`’`).
- **Sensitive PII:** never log names/addresses; never put PII in redirect query strings (ids, status words, and boolean flags only); gated `/admin` routes only.
- **D1 limits:** ≤100 bound params per statement; no query fan-out that scales with row count.
- **No new dependencies.** Reuse `parseMoney` and `parseIntInRange` from `src/lib/validation/application.ts`.
- **Verify before done:** every task ends green on `npm run test`, and the whole plan ends green on `npm run build` and `npx tsc --noEmit`. Baseline suite is **121 tests**.

## File Structure

- `src/lib/db.ts` — add member helpers (T1), employer helpers (T2), `updateApplicationFull` replacing `updateApplicationCore` (T3), single-statement `assignPuNumber` (T7), `escapeLike` + escaped name filter in `listApplications` (T8), extended `ExportRow`/`listApplicationsForExport` (T9).
- `src/pages/admin/applications/[id]/edit.astro` — extended to all application-row fields + validation/CSRF banners (T3).
- `src/pages/admin/applications/[id]/members.astro` — new household-members editor (T4).
- `src/pages/admin/applications/[id]/employers.astro` — new jobs editor (T5).
- `src/pages/admin/applications/[id].astro` — three editor buttons (T4/T5), PRG + banners on approve/deny/set_bags (T6).
- `src/pages/admin/applications/[id]/restore.ts` — redirect `?restored=1` (T10).
- `src/pages/admin/applications/index.astro` — restored banner (T10); export href already carries `q`.
- `src/pages/admin/applications/export.csv.ts` — new columns + honor `q` (T9).
- `src/pages/admin/content/index.astro`, `src/pages/admin/content/[id]/restore.ts` — PRG + restored banner (T10).
- `src/pages/admin/pickup/index.astro`, `src/pages/admin/pickup/[id]/restore.ts` — PRG + restored banner (T10).
- `src/pages/application.pdf.ts` — `Cache-Control: no-cache` (T11).
- Tests: `tests/db-members.test.ts` (T1), `tests/db-employers.test.ts` (T2), `tests/db-application-edit.test.ts` (T3), `tests/db-pu.test.ts` (T7), `tests/db-search-escape.test.ts` (T8), extend `tests/db-admin-export.test.ts` (T9).

---

### Task 1: Data layer — household member helpers

**Files:**
- Modify: `src/lib/db.ts` (append after the existing `restorePickupDay`/`movePickupDay` helpers, at end of file)
- Test: `tests/db-members.test.ts`

**Interfaces:**
- Consumes: `getTestDb` from `tests/helpers/d1`; `insertApplication`, `NewApplication` from `src/lib/db` (for test seeding).
- Produces:
  - `type MemberEdit = { name: string; relationship: string; sex: string; age: number; pants: string; shirtTop: string; underwear: string; socks: string; diapers: string; gifts: string }`
  - `insertMember(db: D1Database, applicationId: number, m: MemberEdit): Promise<number>` — inserts at `position = current max + 1`, returns new id.
  - `updateMember(db: D1Database, id: number, applicationId: number, m: MemberEdit): Promise<void>` — updates only when `id` belongs to `applicationId`.
  - `deleteMember(db: D1Database, id: number, applicationId: number): Promise<void>` — deletes only when `id` belongs to `applicationId`, then renumbers remaining members `1..n` by ascending `position`.

- [ ] **Step 1: Write the failing test** — `tests/db-members.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, insertMember, updateMember, deleteMember,
  type NewApplication, type MemberEdit,
} from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Fam', lastName: 'Ily', address: '1 St', cityId: 13, phone: '555', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Parent', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};
const kid = (name: string): MemberEdit => ({ name, relationship: 'child', sex: 'M', age: 8, pants: '8', shirtTop: 'M', underwear: '8', socks: 'M', diapers: '', gifts: 'lego' });

describe('household member admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('inserts a member at the next position and updates it', async () => {
    const id = await insertApplication(db, app);
    const mid = await insertMember(db, id, kid('Sam'));
    let detail = await getApplicationDetail(db, id);
    expect(detail!.members.map((m) => m.name)).toEqual(['Parent', 'Sam']);
    expect(detail!.members[1].position).toBe(2);
    await updateMember(db, mid, id, { ...kid('Samuel'), age: 9 });
    detail = await getApplicationDetail(db, id);
    expect(detail!.members[1].name).toBe('Samuel');
    expect(detail!.members[1].age).toBe(9);
  });

  it('deletes a member and renumbers remaining positions 1..n', async () => {
    const id = await insertApplication(db, app);          // Parent @ pos 1
    const a = await insertMember(db, id, kid('A'));        // pos 2
    await insertMember(db, id, kid('B'));                  // pos 3
    await deleteMember(db, a, id);                         // remove pos 2
    const detail = await getApplicationDetail(db, id);
    expect(detail!.members.map((m) => m.name)).toEqual(['Parent', 'B']);
    expect(detail!.members.map((m) => m.position)).toEqual([1, 2]);
  });

  it('does not update or delete a member belonging to a different application', async () => {
    const one = await insertApplication(db, app);
    const two = await insertApplication(db, app);
    const mid = await insertMember(db, one, kid('Keep'));
    await updateMember(db, mid, two, { ...kid('Hacked'), age: 99 }); // wrong app id: no-op
    await deleteMember(db, mid, two);                                 // wrong app id: no-op
    const detail = await getApplicationDetail(db, one);
    expect(detail!.members.some((m) => m.name === 'Keep')).toBe(true);
    expect(detail!.members.some((m) => m.name === 'Hacked')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-members.test.ts`
Expected: FAIL — `insertMember`/`updateMember`/`deleteMember`/`MemberEdit` are not exported.

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/db.ts`

```ts
export type MemberEdit = {
  name: string; relationship: string; sex: string; age: number;
  pants: string; shirtTop: string; underwear: string; socks: string; diapers: string; gifts: string;
};

export async function insertMember(db: D1Database, applicationId: number, m: MemberEdit): Promise<number> {
  const max = await db
    .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM household_members WHERE application_id = ?')
    .bind(applicationId)
    .first<{ m: number }>();
  const res = await db
    .prepare(
      `INSERT INTO household_members
         (application_id, position, name, relationship, sex, age, pants, shirt_top, underwear, socks, diapers, gifts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(applicationId, (max?.m ?? 0) + 1, m.name, m.relationship, m.sex, m.age, m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.gifts)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateMember(db: D1Database, id: number, applicationId: number, m: MemberEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE household_members SET
         name = ?, relationship = ?, sex = ?, age = ?,
         pants = ?, shirt_top = ?, underwear = ?, socks = ?, diapers = ?, gifts = ?
       WHERE id = ? AND application_id = ?`,
    )
    .bind(m.name, m.relationship, m.sex, m.age, m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.gifts, id, applicationId)
    .run();
}

export async function deleteMember(db: D1Database, id: number, applicationId: number): Promise<void> {
  await db.prepare('DELETE FROM household_members WHERE id = ? AND application_id = ?').bind(id, applicationId).run();
  // Renumber the survivors 1..n by ascending position so gaps do not accumulate.
  const { results } = await db
    .prepare('SELECT id FROM household_members WHERE application_id = ? ORDER BY position, id')
    .bind(applicationId)
    .all<{ id: number }>();
  if (results.length > 0) {
    await db.batch(
      results.map((r, i) =>
        db.prepare('UPDATE household_members SET position = ? WHERE id = ?').bind(i + 1, r.id)),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/db-members.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-members.test.ts
git commit -m "feat: household member admin helpers (insert/update/delete scoped by application)"
```

---

### Task 2: Data layer — employer helpers

**Files:**
- Modify: `src/lib/db.ts` (append at end of file, after Task 1 helpers)
- Test: `tests/db-employers.test.ts`

**Interfaces:**
- Consumes: `getTestDb`; `insertApplication`, `NewApplication`, `getApplicationDetail`.
- Produces:
  - `type EmployerEdit = { employerName: string; workerName: string; hourlyWage: number; hoursPerWeek: number }`
  - `insertEmployer(db, applicationId, e): Promise<number>`
  - `updateEmployer(db, id, applicationId, e): Promise<void>` — scoped by `application_id`.
  - `deleteEmployer(db, id, applicationId): Promise<void>` — scoped by `application_id` (no renumber; employers order by `id`).

- [ ] **Step 1: Write the failing test** — `tests/db-employers.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, insertEmployer, updateEmployer, deleteEmployer,
  type NewApplication, type EmployerEdit,
} from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Fam', lastName: 'Ily', address: '1 St', cityId: 13, phone: '555', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Parent', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};
const job = (name: string): EmployerEdit => ({ employerName: name, workerName: 'Parent', hourlyWage: 15, hoursPerWeek: 40 });

describe('employer admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('inserts, updates, and deletes an employer', async () => {
    const id = await insertApplication(db, app);
    const eid = await insertEmployer(db, id, job('Acme'));
    let detail = await getApplicationDetail(db, id);
    expect(detail!.employers.map((e) => e.employer_name)).toEqual(['Acme']);
    await updateEmployer(db, eid, id, { ...job('Acme'), hourlyWage: 18.5, hoursPerWeek: 32 });
    detail = await getApplicationDetail(db, id);
    expect(detail!.employers[0].hourly_wage).toBe(18.5);
    expect(detail!.employers[0].hours_per_week).toBe(32);
    await deleteEmployer(db, eid, id);
    detail = await getApplicationDetail(db, id);
    expect(detail!.employers.length).toBe(0);
  });

  it('does not touch an employer belonging to a different application', async () => {
    const one = await insertApplication(db, app);
    const two = await insertApplication(db, app);
    const eid = await insertEmployer(db, one, job('Keep'));
    await updateEmployer(db, eid, two, { ...job('Hacked'), hourlyWage: 1, hoursPerWeek: 1 });
    await deleteEmployer(db, eid, two);
    const detail = await getApplicationDetail(db, one);
    expect(detail!.employers.map((e) => e.employer_name)).toEqual(['Keep']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-employers.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/db.ts`

```ts
export type EmployerEdit = { employerName: string; workerName: string; hourlyWage: number; hoursPerWeek: number };

export async function insertEmployer(db: D1Database, applicationId: number, e: EmployerEdit): Promise<number> {
  const res = await db
    .prepare('INSERT INTO employers (application_id, employer_name, worker_name, hourly_wage, hours_per_week) VALUES (?, ?, ?, ?, ?)')
    .bind(applicationId, e.employerName, e.workerName, e.hourlyWage, e.hoursPerWeek)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateEmployer(db: D1Database, id: number, applicationId: number, e: EmployerEdit): Promise<void> {
  await db
    .prepare('UPDATE employers SET employer_name = ?, worker_name = ?, hourly_wage = ?, hours_per_week = ? WHERE id = ? AND application_id = ?')
    .bind(e.employerName, e.workerName, e.hourlyWage, e.hoursPerWeek, id, applicationId)
    .run();
}

export async function deleteEmployer(db: D1Database, id: number, applicationId: number): Promise<void> {
  await db.prepare('DELETE FROM employers WHERE id = ? AND application_id = ?').bind(id, applicationId).run();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/db-employers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-employers.test.ts
git commit -m "feat: employer admin helpers (insert/update/delete scoped by application)"
```

---

### Task 3: Data layer `updateApplicationFull` + extend the Edit details page

**Files:**
- Modify: `src/lib/db.ts:255-288` (replace `ApplicationCoreEdit` type + `updateApplicationCore`)
- Modify: `src/pages/admin/applications/[id]/edit.astro` (full rewrite of the form + POST handling)
- Test: `tests/db-application-edit.test.ts`

**Interfaces:**
- Consumes: `getApplicationDetail`; `parseMoney`, `parseIntInRange` from `src/lib/validation/application`.
- Produces:
  - `type ApplicationFullEdit` = the old `ApplicationCoreEdit` fields PLUS: `fullTimeResidenceConfirmed: boolean; noEmploymentConfirmed: boolean; foodShareAmount: number | null; socialSecurityAmount: number | null; socialSecurityFor: string; ssiAmount: number | null; ssiFor: string; childSupportAmount: number | null; childSupportFor: string; unemploymentWeeklyAmount: number | null; unemploymentFor: string; otherIncomeAmount: number | null; otherIncomeFor: string; goodDeed: string; mayNotBeEligible: boolean`.
  - `updateApplicationFull(db: D1Database, id: number, f: ApplicationFullEdit): Promise<void>`.
  - `updateApplicationCore` and `ApplicationCoreEdit` are **removed** (no other caller exists — grep confirms only `edit.astro` uses it).

- [ ] **Step 1: Write the failing test** — `tests/db-application-edit.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, updateApplicationFull,
  type NewApplication, type ApplicationFullEdit,
} from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Old', lastName: 'Name', address: '1 St', cityId: 13, phone: '555', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: false,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Parent', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'first', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('updateApplicationFull', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('round-trips every editable field including null amounts', async () => {
    const id = await insertApplication(db, app);
    const edit: ApplicationFullEdit = {
      firstName: 'New', lastName: 'Name2', address: '2 Ave', cityId: 13, phone: '999', email: 'c@d.co',
      diabetic: true, shareWithSponsor: true, permanentlyDisabled: true,
      bedChoice: 'blanket', bedSize: 'queen', yearsReceivedHelp: 3, adoptedLastYear: true, householdType: 'elderly',
      fullTimeResidenceConfirmed: true, noEmploymentConfirmed: false,
      foodShareAmount: 250, socialSecurityAmount: 800, socialSecurityFor: 'self',
      ssiAmount: null, ssiFor: '', childSupportAmount: 120.5, childSupportFor: 'kids',
      unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '',
      goodDeed: 'second', mayNotBeEligible: true,
    };
    await updateApplicationFull(db, id, edit);
    const a = (await getApplicationDetail(db, id))!.app;
    expect(a.first_name).toBe('New');
    expect(a.diabetic).toBe(1);
    expect(a.bed_choice).toBe('blanket');
    expect(a.bed_size).toBe('queen');
    expect(a.food_share_amount).toBe(250);
    expect(a.child_support_amount).toBe(120.5);
    expect(a.ssi_amount).toBe(null);
    expect(a.good_deed).toBe('second');
    expect(a.may_not_be_eligible).toBe(1);
    expect(a.household_type).toBe('elderly');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-application-edit.test.ts`
Expected: FAIL — `updateApplicationFull`/`ApplicationFullEdit` not exported.

- [ ] **Step 3: Write minimal implementation** — replace `src/lib/db.ts:255-288`

```ts
export type ApplicationFullEdit = {
  firstName: string;
  lastName: string;
  address: string;
  cityId: number;
  phone: string;
  email: string;
  diabetic: boolean;
  shareWithSponsor: boolean;
  permanentlyDisabled: boolean;
  bedChoice: 'sheets' | 'blanket' | 'none';
  bedSize: 'twin' | 'full' | 'queen' | 'king' | null;
  yearsReceivedHelp: number;
  adoptedLastYear: boolean;
  householdType: 'family' | 'elderly' | 'disabled';
  fullTimeResidenceConfirmed: boolean;
  noEmploymentConfirmed: boolean;
  foodShareAmount: number | null;
  socialSecurityAmount: number | null;
  socialSecurityFor: string;
  ssiAmount: number | null;
  ssiFor: string;
  childSupportAmount: number | null;
  childSupportFor: string;
  unemploymentWeeklyAmount: number | null;
  unemploymentFor: string;
  otherIncomeAmount: number | null;
  otherIncomeFor: string;
  goodDeed: string;
  mayNotBeEligible: boolean;
};

export async function updateApplicationFull(db: D1Database, id: number, f: ApplicationFullEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE applications SET
         first_name = ?, last_name = ?, address = ?, city_id = ?, phone = ?, email = ?,
         diabetic = ?, share_with_sponsor = ?, permanently_disabled = ?,
         bed_choice = ?, bed_size = ?, years_received_help = ?, adopted_last_year = ?, household_type = ?,
         full_time_residence_confirmed = ?, no_employment_confirmed = ?,
         food_share_amount = ?,
         social_security_amount = ?, social_security_for = ?,
         ssi_amount = ?, ssi_for = ?,
         child_support_amount = ?, child_support_for = ?,
         unemployment_weekly_amount = ?, unemployment_for = ?,
         other_income_amount = ?, other_income_for = ?,
         good_deed = ?, may_not_be_eligible = ?
       WHERE id = ?`,
    )
    .bind(
      f.firstName, f.lastName, f.address, f.cityId, f.phone, f.email,
      f.diabetic ? 1 : 0, f.shareWithSponsor ? 1 : 0, f.permanentlyDisabled ? 1 : 0,
      f.bedChoice, f.bedSize, f.yearsReceivedHelp, f.adoptedLastYear ? 1 : 0, f.householdType,
      f.fullTimeResidenceConfirmed ? 1 : 0, f.noEmploymentConfirmed ? 1 : 0,
      f.foodShareAmount,
      f.socialSecurityAmount, f.socialSecurityFor,
      f.ssiAmount, f.ssiFor,
      f.childSupportAmount, f.childSupportFor,
      f.unemploymentWeeklyAmount, f.unemploymentFor,
      f.otherIncomeAmount, f.otherIncomeFor,
      f.goodDeed, f.mayNotBeEligible ? 1 : 0,
      id,
    )
    .run();
}
```

- [ ] **Step 3b: Run the db test to verify it passes**

Run: `npm run test -- tests/db-application-edit.test.ts`
Expected: PASS (1 test).

- [ ] **Step 4: Rewrite the Edit details page** — replace all of `src/pages/admin/applications/[id]/edit.astro`

Notes on behavior:
- Amounts: a blank field saves `null`; a non-blank field that is not a valid money value is a **validation error** — nothing is saved, and the page redirects back with `?error=amount`.
- CSRF failure redirects back with `?error=csrf`.
- Success redirects (PRG) to the detail page `/admin/applications/{id}`.

```astro
---
import '../../../../styles/global.css';
import Admin from '../../../../layouts/Admin.astro';
import { getApplicationDetail, listCities, updateApplicationFull, type ApplicationFullEdit } from '../../../../lib/db';
import { parseIntInRange, parseMoney } from '../../../../lib/validation/application';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect(`/admin/applications/${id}/edit?error=csrf`, 303);

  const g = (k: string) => String(form.get(k) ?? '').trim();
  const on = (k: string) => form.get(k) === 'on';
  // Amount fields: blank -> null; non-blank invalid -> validation error.
  const amountKeys = ['food_share_amount', 'social_security_amount', 'ssi_amount', 'child_support_amount', 'unemployment_weekly_amount', 'other_income_amount'] as const;
  const amounts: Record<string, number | null> = {};
  let amountError = false;
  for (const k of amountKeys) {
    const raw = g(k);
    if (raw === '') { amounts[k] = null; continue; }
    const parsed = parseMoney(raw);
    if (parsed === null) { amountError = true; break; }
    amounts[k] = parsed;
  }
  if (amountError) return Astro.redirect(`/admin/applications/${id}/edit?error=amount`, 303);

  const bedChoice = (['sheets', 'blanket', 'none'].includes(g('bed_choice')) ? g('bed_choice') : 'none') as 'sheets' | 'blanket' | 'none';
  const bedSize = ['twin', 'full', 'queen', 'king'].includes(g('bed_size')) ? (g('bed_size') as 'twin' | 'full' | 'queen' | 'king') : null;
  const ht = (['family', 'elderly', 'disabled'].includes(g('household_type')) ? g('household_type') : 'family') as 'family' | 'elderly' | 'disabled';
  const edit: ApplicationFullEdit = {
    firstName: g('first_name'), lastName: g('last_name'), address: g('address'),
    cityId: parseIntInRange(g('city_id'), 1, 9999) ?? 13, phone: g('phone'), email: g('email'),
    diabetic: on('diabetic'), shareWithSponsor: on('share_with_sponsor'), permanentlyDisabled: on('permanently_disabled'),
    bedChoice, bedSize: bedChoice === 'none' ? null : bedSize,
    yearsReceivedHelp: parseIntInRange(g('years_received_help'), 0, 99) ?? 0, adoptedLastYear: on('adopted_last_year'), householdType: ht,
    fullTimeResidenceConfirmed: on('full_time_residence_confirmed'), noEmploymentConfirmed: on('no_employment_confirmed'),
    foodShareAmount: amounts['food_share_amount'], socialSecurityAmount: amounts['social_security_amount'], socialSecurityFor: g('social_security_for'),
    ssiAmount: amounts['ssi_amount'], ssiFor: g('ssi_for'),
    childSupportAmount: amounts['child_support_amount'], childSupportFor: g('child_support_for'),
    unemploymentWeeklyAmount: amounts['unemployment_weekly_amount'], unemploymentFor: g('unemployment_for'),
    otherIncomeAmount: amounts['other_income_amount'], otherIncomeFor: g('other_income_for'),
    goodDeed: g('good_deed'), mayNotBeEligible: on('may_not_be_eligible'),
  };
  await updateApplicationFull(env.DB, id, edit);
  return Astro.redirect(`/admin/applications/${id}`, 303);
}

const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;
const cities = await listCities(env.DB);
const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const a = detail?.app ?? {} as Record<string, unknown>;
const err = new URL(Astro.request.url).searchParams.get('error');
const errText = err === 'amount' ? 'Please type a dollar amount like 250 or 250.00 (or leave it blank).' : err === 'csrf' ? 'That didn\'t save — please try again.' : '';
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
---
<Admin title="Edit details" heading={detail ? `Edit details — ${a.first_name} ${a.last_name}` : 'Not found'} back={{ href: `/admin/applications/${id}`, label: 'Back without saving' }}>
  {!detail ? <p class="mt-4">That application could not be found.</p> : (
    <form method="post" class="mt-6 max-w-2xl space-y-4">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {errText && <div class="rounded border-l-4 border-berry-700 bg-white p-4" role="alert"><p class="font-bold text-berry-800">{errText}</p></div>}
      <p class="text-lg text-stone-600">Help: correct any of the family's details here, then press Save. To change who is in the household or their jobs, use the buttons on the application page.</p>

      <h2 class="text-2xl font-bold text-holly-800">About the household</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block font-semibold">First name<input class={input} type="text" name="first_name" value={a.first_name} /></label>
        <label class="block font-semibold">Last name<input class={input} type="text" name="last_name" value={a.last_name} /></label>
        <label class="block font-semibold">Address<input class={input} type="text" name="address" value={a.address} /></label>
        <label class="block font-semibold">Town
          <select class={input} name="city_id">
            {cities.map((c) => <option value={String(c.id)} selected={c.id === a.city_id}>{c.name}</option>)}
          </select>
        </label>
        <label class="block font-semibold">Phone<input class={input} type="text" name="phone" value={a.phone} /></label>
        <label class="block font-semibold">Email<input class={input} type="email" name="email" value={a.email} /></label>
        <label class="block font-semibold">Bed choice
          <select class={input} name="bed_choice">
            {['none', 'sheets', 'blanket'].map((v) => <option value={v} selected={v === a.bed_choice}>{v}</option>)}
          </select>
        </label>
        <label class="block font-semibold">Bed size
          <select class={input} name="bed_size">
            <option value="" selected={!a.bed_size}>—</option>
            {['twin', 'full', 'queen', 'king'].map((v) => <option value={v} selected={v === a.bed_size}>{v}</option>)}
          </select>
        </label>
        <label class="block font-semibold">Years received help<input class={input} type="text" inputmode="numeric" name="years_received_help" value={a.years_received_help} /></label>
        <label class="block font-semibold">Household type
          <select class={input} name="household_type">
            {['family', 'elderly', 'disabled'].map((v) => <option value={v} selected={v === a.household_type}>{v}</option>)}
          </select>
        </label>
      </div>
      <div class="space-y-2">
        <label class="flex items-center gap-3"><input type="checkbox" name="diabetic" checked={a.diabetic === 1} class="h-6 w-6" /> Someone in the household is diabetic</label>
        <label class="flex items-center gap-3"><input type="checkbox" name="permanently_disabled" checked={a.permanently_disabled === 1} class="h-6 w-6" /> Someone is permanently disabled</label>
        <label class="flex items-center gap-3"><input type="checkbox" name="share_with_sponsor" checked={a.share_with_sponsor === 1} class="h-6 w-6" /> OK to share needs with a sponsor</label>
        <label class="flex items-center gap-3"><input type="checkbox" name="adopted_last_year" checked={a.adopted_last_year === 1} class="h-6 w-6" /> Adopted last year</label>
        <label class="flex items-center gap-3"><input type="checkbox" name="full_time_residence_confirmed" checked={a.full_time_residence_confirmed === 1} class="h-6 w-6" /> Confirmed they live in Grant County full time</label>
        <label class="flex items-center gap-3"><input type="checkbox" name="no_employment_confirmed" checked={a.no_employment_confirmed === 1} class="h-6 w-6" /> Confirmed no one in the household is employed</label>
        <label class="flex items-center gap-3"><input type="checkbox" name="may_not_be_eligible" checked={a.may_not_be_eligible === 1} class="h-6 w-6" /> Flag: may not be eligible (needs a closer look)</label>
      </div>

      <h2 class="text-2xl font-bold text-holly-800">Income and benefits</h2>
      <p class="text-lg text-stone-600">Leave a box blank if it does not apply. Use numbers like 250 or 250.00.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block font-semibold">Food Share (monthly $)<input class={input} type="text" inputmode="decimal" name="food_share_amount" value={a.food_share_amount ?? ''} /></label>
        <div></div>
        <label class="block font-semibold">Social Security ($)<input class={input} type="text" inputmode="decimal" name="social_security_amount" value={a.social_security_amount ?? ''} /></label>
        <label class="block font-semibold">Social Security — for whom<input class={input} type="text" name="social_security_for" value={a.social_security_for ?? ''} /></label>
        <label class="block font-semibold">SSI ($)<input class={input} type="text" inputmode="decimal" name="ssi_amount" value={a.ssi_amount ?? ''} /></label>
        <label class="block font-semibold">SSI — for whom<input class={input} type="text" name="ssi_for" value={a.ssi_for ?? ''} /></label>
        <label class="block font-semibold">Child support ($)<input class={input} type="text" inputmode="decimal" name="child_support_amount" value={a.child_support_amount ?? ''} /></label>
        <label class="block font-semibold">Child support — for whom<input class={input} type="text" name="child_support_for" value={a.child_support_for ?? ''} /></label>
        <label class="block font-semibold">Unemployment (weekly $)<input class={input} type="text" inputmode="decimal" name="unemployment_weekly_amount" value={a.unemployment_weekly_amount ?? ''} /></label>
        <label class="block font-semibold">Unemployment — for whom<input class={input} type="text" name="unemployment_for" value={a.unemployment_for ?? ''} /></label>
        <label class="block font-semibold">Other income ($)<input class={input} type="text" inputmode="decimal" name="other_income_amount" value={a.other_income_amount ?? ''} /></label>
        <label class="block font-semibold">Other income — for whom<input class={input} type="text" name="other_income_for" value={a.other_income_for ?? ''} /></label>
      </div>

      <h2 class="text-2xl font-bold text-holly-800">Good deed</h2>
      <label class="block font-semibold">What good deed did they do?<textarea class={input} name="good_deed" rows="3">{a.good_deed}</textarea></label>

      <button type="submit" class="rounded-lg bg-holly-700 px-6 py-3 text-lg font-bold text-white hover:bg-holly-900">Save changes</button>
    </form>
  )}
</Admin>
```

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npm run test` then `npx tsc --noEmit`
Expected: all tests PASS (baseline + the new db-members, db-employers, db-application-edit tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/pages/admin/applications/[id]/edit.astro tests/db-application-edit.test.ts
git commit -m "feat: edit all application-row fields (income/benefits/confirmations); replace updateApplicationCore"
```

---

### Task 4: Household members editor page

**Files:**
- Create: `src/pages/admin/applications/[id]/members.astro`
- Modify: `src/pages/admin/applications/[id].astro` (relabel the existing edit button and add a "Edit household members" button — see Step 2)

**Interfaces:**
- Consumes: `getApplicationDetail`, `insertMember`, `updateMember`, `deleteMember`, `MemberEdit` (T1); `parseIntInRange`; CSRF helpers; `MAX_MEMBERS` from `src/lib/validation/application`.
- Produces: route `/admin/applications/{id}/members` with acts `create`, `update`, `delete`.

- [ ] **Step 1: Create `src/pages/admin/applications/[id]/members.astro`**

Behavior: per-row form (Save + Remove); an "Add a person" form; name required and age must be 0–120 (else `?error=fields`); remove hard-deletes with a `data-confirm`; all mutations PRG-redirect back with a banner flag. Cap at `MAX_MEMBERS`.

```astro
---
import '../../../../styles/global.css';
import Admin from '../../../../layouts/Admin.astro';
import { getApplicationDetail, insertMember, updateMember, deleteMember, type MemberEdit } from '../../../../lib/db';
import { parseIntInRange, MAX_MEMBERS } from '../../../../lib/validation/application';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);
const base = `/admin/applications/${id}/members`;

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect(`${base}?error=csrf`, 303);
  const act = String(form.get('act') ?? '');
  const memberId = Number(form.get('member_id'));
  const g = (k: string) => String(form.get(k) ?? '').trim();
  const detail = await getApplicationDetail(env.DB, id);
  if (!detail) return Astro.redirect(base, 303);

  if (act === 'delete' && Number.isInteger(memberId)) {
    await deleteMember(env.DB, memberId, id);
    return Astro.redirect(`${base}?removed=1`, 303);
  }
  const age = parseIntInRange(g('age'), 0, 120);
  const name = g('name');
  if (name === '' || age === null) return Astro.redirect(`${base}?error=fields`, 303);
  const m: MemberEdit = {
    name, relationship: g('relationship'), sex: g('sex'), age,
    pants: g('pants'), shirtTop: g('shirt_top'), underwear: g('underwear'), socks: g('socks'), diapers: g('diapers'), gifts: g('gifts'),
  };
  if (act === 'create') {
    if (detail.members.length >= MAX_MEMBERS) return Astro.redirect(`${base}?error=full`, 303);
    await insertMember(env.DB, id, m);
    return Astro.redirect(`${base}?added=1`, 303);
  }
  if (act === 'update' && Number.isInteger(memberId)) {
    await updateMember(env.DB, memberId, id, m);
    return Astro.redirect(`${base}?saved=1`, 303);
  }
  return Astro.redirect(base, 303);
}

const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;
const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const a = detail?.app ?? {} as Record<string, unknown>;
const flags = new URL(Astro.request.url).searchParams;
const banner = flags.get('added') ? 'Person added.' : flags.get('saved') ? 'Saved.' : flags.get('removed') ? 'Person removed.'
  : flags.get('error') === 'fields' ? 'Please enter a name and an age (0-120).'
  : flags.get('error') === 'full' ? 'That is the most people we can list for one household.'
  : flags.get('error') === 'csrf' ? 'That didn\'t save — please try again.' : '';
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
const full = detail ? detail.members.length >= MAX_MEMBERS : false;
---
<Admin title="Edit household members" heading={detail ? `People — ${a.first_name} ${a.last_name}` : 'Not found'} back={{ href: `/admin/applications/${id}`, label: 'Back to the application' }}>
  {!detail ? <p class="mt-4">That application could not be found.</p> : (
    <>
      <p class="mt-1 text-lg text-stone-600">Help: fix a person's details and press Save. Add someone at the bottom, or press Remove to take a person off this application.</p>
      {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}

      {detail.members.map((m) => (
        <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
          <form method="post" class="space-y-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="member_id" value={String(m.id)} />
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block font-semibold">Name<input class={input} type="text" name="name" value={m.name} /></label>
              <label class="block font-semibold">Relationship<input class={input} type="text" name="relationship" value={m.relationship} /></label>
              <label class="block font-semibold">Sex<input class={input} type="text" name="sex" value={m.sex} /></label>
              <label class="block font-semibold">Age<input class={input} type="text" inputmode="numeric" name="age" value={m.age} /></label>
              <label class="block font-semibold">Pants size<input class={input} type="text" name="pants" value={m.pants} /></label>
              <label class="block font-semibold">Shirt/top size<input class={input} type="text" name="shirt_top" value={m.shirt_top} /></label>
              <label class="block font-semibold">Underwear size<input class={input} type="text" name="underwear" value={m.underwear} /></label>
              <label class="block font-semibold">Socks size<input class={input} type="text" name="socks" value={m.socks} /></label>
              <label class="block font-semibold">Diapers size<input class={input} type="text" name="diapers" value={m.diapers} /></label>
              <label class="block font-semibold">Gifts / toys wanted<input class={input} type="text" name="gifts" value={m.gifts} /></label>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="submit" name="act" value="update" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save</button>
              <button type="submit" name="act" value="delete" data-confirm="Remove this person from the application? This cannot be undone." class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Remove</button>
            </div>
          </form>
        </section>
      ))}

      <section class="mt-8 rounded-lg border-2 border-holly-700 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Add a person</h2>
        {full ? <p class="mt-2 text-lg">This household already has the most people we can list.</p> : (
          <form method="post" class="mt-3 space-y-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block font-semibold">Name<input class={input} type="text" name="name" /></label>
              <label class="block font-semibold">Relationship<input class={input} type="text" name="relationship" /></label>
              <label class="block font-semibold">Sex<input class={input} type="text" name="sex" /></label>
              <label class="block font-semibold">Age<input class={input} type="text" inputmode="numeric" name="age" /></label>
              <label class="block font-semibold">Pants size<input class={input} type="text" name="pants" /></label>
              <label class="block font-semibold">Shirt/top size<input class={input} type="text" name="shirt_top" /></label>
              <label class="block font-semibold">Underwear size<input class={input} type="text" name="underwear" /></label>
              <label class="block font-semibold">Socks size<input class={input} type="text" name="socks" /></label>
              <label class="block font-semibold">Diapers size<input class={input} type="text" name="diapers" /></label>
              <label class="block font-semibold">Gifts / toys wanted<input class={input} type="text" name="gifts" /></label>
            </div>
            <button type="submit" name="act" value="create" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Add this person</button>
          </form>
        )}
      </section>

      <script src="/scripts/print-button.js" defer></script>
    </>
  )}
</Admin>
```

- [ ] **Step 2: Add the button on the detail page** — modify `src/pages/admin/applications/[id].astro`

Replace the action row (currently the `<section>` containing "Print pickup slip" and "Edit this application", around lines 123-126):

```astro
      <section class="mt-6 flex flex-wrap gap-3">
        <a href={`/admin/applications/${id}/slip`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Print pickup slip</a>
        <a href={`/admin/applications/${id}/edit`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Edit details</a>
        <a href={`/admin/applications/${id}/members`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Edit household members</a>
      </section>
```

(The "Edit jobs" button is added in Task 5.)

- [ ] **Step 3: Verify build + typecheck**

Run: `npm run build` then `npx tsc --noEmit`
Expected: build Complete!, tsc clean. (Manually confirm the page renders by reading it; page behavior is verified by the task review.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/applications/[id]/members.astro src/pages/admin/applications/[id].astro
git commit -m "feat: household members editor (add/edit/remove), linked from the application page"
```

---

### Task 5: Jobs (employers) editor page

**Files:**
- Create: `src/pages/admin/applications/[id]/employers.astro`
- Modify: `src/pages/admin/applications/[id].astro` (add "Edit jobs" button)

**Interfaces:**
- Consumes: `getApplicationDetail`, `insertEmployer`, `updateEmployer`, `deleteEmployer`, `EmployerEdit` (T2); `parseMoney`; CSRF helpers; `MAX_EMPLOYERS` from `src/lib/validation/application`.
- Produces: route `/admin/applications/{id}/employers` with acts `create`, `update`, `delete`.

- [ ] **Step 1: Create `src/pages/admin/applications/[id]/employers.astro`**

Behavior mirrors the members editor. All four fields required; wage and hours must be valid money/number (`parseMoney`), else `?error=fields`. Cap at `MAX_EMPLOYERS`.

```astro
---
import '../../../../styles/global.css';
import Admin from '../../../../layouts/Admin.astro';
import { getApplicationDetail, insertEmployer, updateEmployer, deleteEmployer, type EmployerEdit } from '../../../../lib/db';
import { parseMoney, MAX_EMPLOYERS } from '../../../../lib/validation/application';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);
const base = `/admin/applications/${id}/employers`;

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect(`${base}?error=csrf`, 303);
  const act = String(form.get('act') ?? '');
  const employerId = Number(form.get('employer_id'));
  const g = (k: string) => String(form.get(k) ?? '').trim();
  const detail = await getApplicationDetail(env.DB, id);
  if (!detail) return Astro.redirect(base, 303);

  if (act === 'delete' && Number.isInteger(employerId)) {
    await deleteEmployer(env.DB, employerId, id);
    return Astro.redirect(`${base}?removed=1`, 303);
  }
  const wage = parseMoney(g('hourly_wage'));
  const hours = parseMoney(g('hours_per_week'));
  const employerName = g('employer_name');
  const workerName = g('worker_name');
  if (employerName === '' || workerName === '' || wage === null || hours === null) return Astro.redirect(`${base}?error=fields`, 303);
  const e: EmployerEdit = { employerName, workerName, hourlyWage: wage, hoursPerWeek: hours };
  if (act === 'create') {
    if (detail.employers.length >= MAX_EMPLOYERS) return Astro.redirect(`${base}?error=full`, 303);
    await insertEmployer(env.DB, id, e);
    return Astro.redirect(`${base}?added=1`, 303);
  }
  if (act === 'update' && Number.isInteger(employerId)) {
    await updateEmployer(env.DB, employerId, id, e);
    return Astro.redirect(`${base}?saved=1`, 303);
  }
  return Astro.redirect(base, 303);
}

const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;
const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const a = detail?.app ?? {} as Record<string, unknown>;
const flags = new URL(Astro.request.url).searchParams;
const banner = flags.get('added') ? 'Job added.' : flags.get('saved') ? 'Saved.' : flags.get('removed') ? 'Job removed.'
  : flags.get('error') === 'fields' ? 'Please fill in the employer, worker, wage, and hours (numbers for wage and hours).'
  : flags.get('error') === 'full' ? 'That is the most jobs we can list for one household.'
  : flags.get('error') === 'csrf' ? 'That didn\'t save — please try again.' : '';
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
const full = detail ? detail.employers.length >= MAX_EMPLOYERS : false;
---
<Admin title="Edit jobs" heading={detail ? `Jobs — ${a.first_name} ${a.last_name}` : 'Not found'} back={{ href: `/admin/applications/${id}`, label: 'Back to the application' }}>
  {!detail ? <p class="mt-4">That application could not be found.</p> : (
    <>
      <p class="mt-1 text-lg text-stone-600">Help: correct a job and press Save, add a job at the bottom, or press Remove to take a job off this application.</p>
      {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}

      {detail.employers.map((e) => (
        <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
          <form method="post" class="space-y-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="employer_id" value={String(e.id)} />
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block font-semibold">Employer<input class={input} type="text" name="employer_name" value={e.employer_name} /></label>
              <label class="block font-semibold">Worker<input class={input} type="text" name="worker_name" value={e.worker_name} /></label>
              <label class="block font-semibold">Hourly wage ($)<input class={input} type="text" inputmode="decimal" name="hourly_wage" value={e.hourly_wage} /></label>
              <label class="block font-semibold">Hours per week<input class={input} type="text" inputmode="decimal" name="hours_per_week" value={e.hours_per_week} /></label>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="submit" name="act" value="update" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save</button>
              <button type="submit" name="act" value="delete" data-confirm="Remove this job from the application? This cannot be undone." class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Remove</button>
            </div>
          </form>
        </section>
      ))}

      <section class="mt-8 rounded-lg border-2 border-holly-700 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Add a job</h2>
        {full ? <p class="mt-2 text-lg">This household already has the most jobs we can list.</p> : (
          <form method="post" class="mt-3 space-y-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block font-semibold">Employer<input class={input} type="text" name="employer_name" /></label>
              <label class="block font-semibold">Worker<input class={input} type="text" name="worker_name" /></label>
              <label class="block font-semibold">Hourly wage ($)<input class={input} type="text" inputmode="decimal" name="hourly_wage" /></label>
              <label class="block font-semibold">Hours per week<input class={input} type="text" inputmode="decimal" name="hours_per_week" /></label>
            </div>
            <button type="submit" name="act" value="create" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Add this job</button>
          </form>
        )}
      </section>

      <script src="/scripts/print-button.js" defer></script>
    </>
  )}
</Admin>
```

- [ ] **Step 2: Add the button on the detail page** — modify `src/pages/admin/applications/[id].astro`

Add the "Edit jobs" link to the action row created in Task 4 so it reads:

```astro
      <section class="mt-6 flex flex-wrap gap-3">
        <a href={`/admin/applications/${id}/slip`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Print pickup slip</a>
        <a href={`/admin/applications/${id}/edit`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Edit details</a>
        <a href={`/admin/applications/${id}/members`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Edit household members</a>
        <a href={`/admin/applications/${id}/employers`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Edit jobs</a>
      </section>
```

- [ ] **Step 3: Verify build + typecheck**

Run: `npm run build` then `npx tsc --noEmit`
Expected: build Complete!, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/applications/[id]/employers.astro src/pages/admin/applications/[id].astro
git commit -m "feat: jobs (employers) editor (add/edit/remove), linked from the application page"
```

---

### Task 6: PRG + banners on approve/deny/set_bags (detail page)

**Files:**
- Modify: `src/pages/admin/applications/[id].astro` (POST handling + banner rendering)

**Interfaces:**
- Consumes: existing `assignPuNumber`, `setApplicationStatus`, `setBagsCount`, `softDeleteApplication`, `sendEmail`, `renderApprovedEmail`, `renderDeniedEmail`.
- Produces: the detail page no longer re-renders after a POST — every branch redirects (303). Banner text derives from the `?done=` / `?error=` query params.

Rationale: today approve/deny re-render in place, so a browser refresh re-POSTs and re-sends the applicant email. Email send failures must still be surfaced; we carry a compact `mail=` flag rather than the (possibly PII-bearing) error text.

- [ ] **Step 1: Replace the POST block** (`[id].astro`, currently lines 14-52) with a redirecting version

```astro
const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);
const detailUrl = `/admin/applications/${id}`;

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect(`${detailUrl}?error=csrf`, 303);
  const act = String(form.get('act') ?? '');
  const detail = await getApplicationDetail(env.DB, id);
  if (detail) {
    const season = detail.app.season_year as number;
    const firstName = detail.app.first_name as string;
    const email = detail.app.email as string;
    if (act === 'approve_email' || act === 'approve_silent') {
      await assignPuNumber(env.DB, id, season);
      await setApplicationStatus(env.DB, id, 'approved');
      if (act === 'approve_email') {
        const r = await sendEmail(env, email, renderApprovedEmail(firstName));
        return Astro.redirect(`${detailUrl}?done=approved&mail=${r.sent ? 'ok' : 'fail'}`, 303);
      }
      return Astro.redirect(`${detailUrl}?done=approved`, 303);
    } else if (act === 'deny_email' || act === 'deny_silent') {
      await setApplicationStatus(env.DB, id, 'denied');
      if (act === 'deny_email') {
        const r = await sendEmail(env, email, renderDeniedEmail(firstName));
        return Astro.redirect(`${detailUrl}?done=denied&mail=${r.sent ? 'ok' : 'fail'}`, 303);
      }
      return Astro.redirect(`${detailUrl}?done=denied`, 303);
    } else if (act === 'set_bags') {
      const raw = String(form.get('bags_count') ?? '').trim();
      await setBagsCount(env.DB, id, raw === '' ? null : Math.max(0, Math.floor(Number(raw)) || 0));
      return Astro.redirect(`${detailUrl}?done=bags`, 303);
    } else if (act === 'delete') {
      await softDeleteApplication(env.DB, id, new Date().toISOString());
      return Astro.redirect(`/admin/applications?undo=${id}`, 303);
    }
  }
  return Astro.redirect(detailUrl, 303);
}
```

- [ ] **Step 2: Replace the banner derivation** (currently lines 54-64, the block that computes `banner`/`emailNote`) — remove the now-unused `let banner`/`let emailNote` declarations at the top too

```astro
const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);

const flags = new URL(Astro.request.url).searchParams;
const done = flags.get('done');
const mail = flags.get('mail');
const mailNote = mail === 'ok' ? ' The email was sent.' : mail === 'fail' ? ' The email could not be sent right now — the application is still saved.' : '';
const banner = done === 'approved' ? `Approved.${mailNote}` : done === 'denied' ? `Marked as denied.${mailNote}` : done === 'bags' ? 'Bag count saved.' : flags.get('error') === 'csrf' ? 'That didn\'t save — please try again.' : '';

const money = (v: unknown) => (v == null ? '—' : `$${Number(v).toFixed(2)}`);
const yesno = (v: unknown) => (v === 1 || v === true ? 'Yes' : 'No');
const a = detail?.app ?? {};
const statusWord = a.status === 'approved' ? 'Approved' : a.status === 'denied' ? 'Denied' : 'To review';
```

- [ ] **Step 3: Update the banner element** (currently line 71) so it no longer references `emailNote`

```astro
      {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}
```

- [ ] **Step 4: Verify build + typecheck + suite**

Run: `npm run build` then `npx tsc --noEmit` then `npm run test`
Expected: build Complete!, tsc clean (no unused `emailNote`), tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/applications/[id].astro
git commit -m "fix: PRG on approve/deny/set-bags so a refresh cannot re-send the applicant email"
```

---

### Task 7: Single-statement `assignPuNumber`

**Files:**
- Modify: `src/lib/db.ts:220-233` (`assignPuNumber`)
- Test: `tests/db-pu.test.ts`

**Interfaces:**
- Produces: `assignPuNumber(db, id, seasonYear)` unchanged signature/return, but the "assign next" path is a single UPDATE (no read-then-write gap). Still idempotent (returns the existing number when already assigned).

- [ ] **Step 1: Write the failing test** — `tests/db-pu.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, assignPuNumber, type NewApplication } from '../src/lib/db';

const app: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('assignPuNumber', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('hands out increasing numbers per season and is idempotent', async () => {
    const one = await insertApplication(db, app);
    const two = await insertApplication(db, app);
    expect(await assignPuNumber(db, one, 2026)).toBe(1);
    expect(await assignPuNumber(db, two, 2026)).toBe(2);
    expect(await assignPuNumber(db, one, 2026)).toBe(1); // idempotent
  });

  it('numbers restart from 1 in a different season', async () => {
    const older = await insertApplication(db, { ...app, seasonYear: 2025 });
    expect(await assignPuNumber(db, older, 2025)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes against the old code**

Run: `npm run test -- tests/db-pu.test.ts`
Expected: PASS against the current implementation (the test also documents current behavior). This is a refactor guarded by tests — keep them green through the change.

- [ ] **Step 3: Replace `assignPuNumber`** (`src/lib/db.ts:220-233`)

```ts
export async function assignPuNumber(db: D1Database, id: number, seasonYear: number): Promise<number> {
  // Single-statement assign: only fills a NULL pu_number, so it is idempotent and
  // closes the read-then-write gap of the previous version. The subquery excludes
  // the row being updated (its pu_number is still NULL) and soft-deleted rows.
  await db
    .prepare(
      `UPDATE applications
         SET pu_number = (SELECT COALESCE(MAX(pu_number), 0) + 1 FROM applications
                          WHERE season_year = ?1 AND deleted_at IS NULL)
       WHERE id = ?2 AND season_year = ?1 AND pu_number IS NULL`,
    )
    .bind(seasonYear, id)
    .run();
  const row = await db
    .prepare('SELECT pu_number FROM applications WHERE id = ?')
    .bind(id)
    .first<{ pu_number: number | null }>();
  return row?.pu_number ?? 0;
}
```

- [ ] **Step 4: Run tests to verify still green**

Run: `npm run test -- tests/db-pu.test.ts tests/db-admin-slips.test.ts`
Expected: PASS (new pu tests + the existing slips tests that exercise `assignPuNumber`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-pu.test.ts
git commit -m "refactor: single-statement assignPuNumber (removes read-then-write race)"
```

---

### Task 8: Escape LIKE wildcards in the name search

**Files:**
- Modify: `src/lib/db.ts` (`listApplications:148-178` — add `escapeLike` and `ESCAPE '\'`)
- Test: `tests/db-search-escape.test.ts`

**Interfaces:**
- Produces: `export function escapeLike(s: string): string` (escapes `\`, `%`, `_`); `listApplications` uses it and appends `ESCAPE '\\'` to each `LIKE`.

- [ ] **Step 1: Write the failing test** — `tests/db-search-escape.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, listApplications, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('name search LIKE escaping', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('treats % as a literal, not a wildcard', async () => {
    await insertApplication(db, { ...base, lastName: 'Per%cent' });
    await insertApplication(db, { ...base, lastName: 'Percent' });
    const hits = await listApplications(db, 2026, 'all', '%');   // would match everything if unescaped
    expect(hits.every((r) => r.last_name.includes('%'))).toBe(true);
    expect(hits.length).toBe(1);
  });

  it('treats _ as a literal, not a single-char wildcard', async () => {
    await insertApplication(db, { ...base, lastName: 'a_b', firstName: 'Z' });
    const hits = await listApplications(db, 2026, 'all', 'a_b');
    expect(hits.length).toBe(1);
    expect(hits[0].last_name).toBe('a_b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-search-escape.test.ts`
Expected: FAIL — the unescaped `%`/`_` act as wildcards, matching more rows than expected.

- [ ] **Step 3: Implement** — in `src/lib/db.ts`, add `escapeLike` (place it just above `listApplications`) and use it

```ts
// Escape LIKE metacharacters so operator-typed % or _ match literally.
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
```

Then inside `listApplications`, change the `like` line and both prepared statements to escape and declare the escape char:

```ts
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const cols = `a.id, a.first_name, a.last_name, c.name AS city_name, a.submitted_at,
                a.status, a.may_not_be_eligible, a.pu_number`;
  // The name filter is a no-op when the search box is empty (like === '%%').
  const nameFilter = `(? = '%%' OR lower(a.first_name) LIKE ? ESCAPE '\\' OR lower(a.last_name) LIKE ? ESCAPE '\\')`;
```

(The `.bind(...)` calls are unchanged — still `like, like, like`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/db-search-escape.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-search-escape.test.ts
git commit -m "fix: escape LIKE wildcards in admin name search so % and _ match literally"
```

---

### Task 9: Fuller Excel export columns + honor the name filter

**Files:**
- Modify: `src/lib/db.ts` (`ExportRow:290-304` + `listApplicationsForExport:306-328`)
- Modify: `src/pages/admin/applications/export.csv.ts`
- Test: extend `tests/db-admin-export.test.ts`

**Interfaces:**
- Consumes: `escapeLike` (T8).
- Produces:
  - `ExportRow` gains: `years_received_help: number; adopted_last_year: number; bed_choice: string; bed_size: string | null; food_share_amount: number | null; social_security_amount: number | null; ssi_amount: number | null; child_support_amount: number | null; unemployment_weekly_amount: number | null; other_income_amount: number | null; member_count: number; employment_summary: string`.
  - `listApplicationsForExport(db, seasonYear, status, search: string)` — new `search` param applies the same escaped name filter as `listApplications`.

- [ ] **Step 1: Write the failing test** — extend `tests/db-admin-export.test.ts`

Read the existing file first. Add these cases inside its `describe` (reuse its existing seed helper/`base`; if it lacks one, use the `base` object shape from Task 8's test):

```ts
  it('includes the new columns and per-application aggregates', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, {
        ...base, firstName: 'Ex', lastName: 'Port', yearsReceivedHelp: 2, adoptedLastYear: true,
        bedChoice: 'blanket', bedSize: 'full',
        benefits: { ...base.benefits, ssiAmount: 520, ssiFor: 'self', childSupportAmount: 200, childSupportFor: 'kids' },
        members: [
          { name: 'P', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'K', relationship: 'child', sex: 'M', age: 8, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
        ],
        employers: [{ employerName: 'Acme', workerName: 'P', hourlyWage: 15, hoursPerWeek: 40 }],
      });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      const r = rows.find((x) => x.last_name === 'Port')!;
      expect(r.member_count).toBe(2);
      expect(r.years_received_help).toBe(2);
      expect(r.adopted_last_year).toBe(1);
      expect(r.bed_choice).toBe('blanket');
      expect(r.ssi_amount).toBe(520);
      expect(r.employment_summary).toContain('Acme');
      expect(id).toBeGreaterThan(0);
    } finally { await dispose(); }
  });

  it('honors the name filter (with LIKE escaping)', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await insertApplication(db, { ...base, lastName: 'Findme' });
      await insertApplication(db, { ...base, lastName: 'Other' });
      const rows = await listApplicationsForExport(db, 2026, 'all', 'findme');
      expect(rows.length).toBe(1);
      expect(rows[0].last_name).toBe('Findme');
    } finally { await dispose(); }
  });
```

Ensure the file imports `insertApplication` and `listApplicationsForExport` and has a `base: NewApplication` seed (copy the `base` object from Task 8's test if not already present).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-admin-export.test.ts`
Expected: FAIL — new columns/param absent.

- [ ] **Step 3: Implement** — replace `ExportRow` and `listApplicationsForExport` in `src/lib/db.ts`

```ts
export type ExportRow = {
  pu_number: number | null;
  status: string;
  submitted_at: string;
  first_name: string;
  last_name: string;
  address: string;
  city_name: string;
  phone: string;
  email: string;
  household_type: string;
  may_not_be_eligible: number;
  bags_count: number | null;
  years_received_help: number;
  adopted_last_year: number;
  bed_choice: string;
  bed_size: string | null;
  food_share_amount: number | null;
  social_security_amount: number | null;
  ssi_amount: number | null;
  child_support_amount: number | null;
  unemployment_weekly_amount: number | null;
  other_income_amount: number | null;
  member_count: number;
  member_summary: string;
  employment_summary: string;
};

export async function listApplicationsForExport(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
  search: string,
): Promise<ExportRow[]> {
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const statusFilter = status === 'all' ? '' : 'AND a.status = ?2';
  // Name filter is a no-op when the search box is empty (like === '%%').
  const nameFilter = `AND (?3 = '%%' OR lower(a.first_name) LIKE ?3 ESCAPE '\\' OR lower(a.last_name) LIKE ?3 ESCAPE '\\')`;
  const sql = `
    SELECT a.pu_number, a.status, a.submitted_at, a.first_name, a.last_name, a.address,
           c.name AS city_name, a.phone, a.email, a.household_type, a.may_not_be_eligible, a.bags_count,
           a.years_received_help, a.adopted_last_year, a.bed_choice, a.bed_size,
           a.food_share_amount, a.social_security_amount, a.ssi_amount, a.child_support_amount,
           a.unemployment_weekly_amount, a.other_income_amount,
           COUNT(DISTINCT m.id) AS member_count,
           COALESCE(GROUP_CONCAT(m.name || ' (' || m.age || ')', '; '), '') AS member_summary,
           (SELECT COALESCE(GROUP_CONCAT(e.worker_name || ' @ ' || e.employer_name || ': $' || e.hourly_wage || ' x ' || e.hours_per_week, '; '), '')
              FROM employers e WHERE e.application_id = a.id) AS employment_summary
    FROM applications a
    JOIN cities c ON c.id = a.city_id
    LEFT JOIN household_members m ON m.application_id = a.id
    WHERE a.deleted_at IS NULL AND a.season_year = ?1 ${statusFilter} ${nameFilter}
    GROUP BY a.id
    ORDER BY a.submitted_at DESC, a.id DESC`;
  const stmt = db.prepare(sql).bind(seasonYear, status === 'all' ? '' : status, like);
  const { results } = await stmt.all<ExportRow>();
  return results;
}
```

**Why the single `.bind(seasonYear, status === 'all' ? '' : status, like)`:** the SQL always references `?1` (season) and `?3` (like), but references `?2` (status) only when `statusFilter` is non-empty. Binding all three positionally works in both branches — in the `'all'` case `?2` is bound to `''` but never referenced, which SQLite/D1 permits (slot `?2` exists because `?3` is referenced).

- [ ] **Step 4: Update the CSV endpoint** — replace `src/pages/admin/applications/export.csv.ts`

```ts
import type { APIRoute } from 'astro';
import { listApplicationsForExport } from '../../../lib/db';
import { toCsv } from '../../../lib/csv';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const season = Number(url.searchParams.get('season')) || new Date().getFullYear();
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = (['all', 'new', 'approved', 'denied'].includes(statusParam) ? statusParam : 'all') as
    'all' | 'new' | 'approved' | 'denied';
  const search = url.searchParams.get('q') ?? '';
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status, search);
  const money = (v: number | null) => (v == null ? '' : String(v));
  const incomeSummary = (r: (typeof rows)[number]) => [
    ['Food Share', r.food_share_amount], ['Social Security', r.social_security_amount], ['SSI', r.ssi_amount],
    ['Child support', r.child_support_amount], ['Unemployment', r.unemployment_weekly_amount], ['Other', r.other_income_amount],
  ].filter(([, v]) => v != null).map(([k, v]) => `${k} $${v}`).join('; ');
  const headers = [
    'Pickup #', 'Status', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type', 'Check eligibility', 'Bags',
    'People count', 'People', 'Years received', 'Adopted last year', 'Bed', 'Bed size', 'Income', 'Jobs',
  ];
  const body = toCsv(
    headers,
    rows.map((r) => [
      r.pu_number, r.status, r.submitted_at.slice(0, 10), r.first_name, r.last_name, r.address,
      r.city_name, r.phone, r.email, r.household_type, r.may_not_be_eligible === 1 ? 'yes' : '', r.bags_count,
      r.member_count, r.member_summary, r.years_received_help, r.adopted_last_year === 1 ? 'yes' : '',
      r.bed_choice, r.bed_size ?? '', incomeSummary(r), r.employment_summary,
    ]),
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="applications-${season}-${status}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
```

(The list page's "Download for Excel" href already includes `&q=${encodeURIComponent(search)}` — no change needed there.)

- [ ] **Step 5: Run tests + typecheck + build**

Run: `npm run test -- tests/db-admin-export.test.ts` then `npx tsc --noEmit` then `npm run build`
Expected: PASS; tsc clean; build Complete!.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/pages/admin/applications/export.csv.ts tests/db-admin-export.test.ts
git commit -m "feat: richer Excel export (people count, benefits, jobs, more columns) honoring the name filter"
```

---

### Task 10: PRG on news/pickup edits + restore confirmation banners

**Files:**
- Modify: `src/pages/admin/content/index.astro` (redirect after create/update/move; render banner + restored from query)
- Modify: `src/pages/admin/content/[id]/restore.ts` (redirect `?restored=1`)
- Modify: `src/pages/admin/pickup/index.astro` (same PRG + restored)
- Modify: `src/pages/admin/pickup/[id]/restore.ts` (redirect `?restored=1`)
- Modify: `src/pages/admin/applications/[id]/restore.ts` (redirect `?restored=1`)
- Modify: `src/pages/admin/applications/index.astro` (render "It's back in your list." when `?restored=1`)

**Interfaces:**
- No new exports. Behavior: after a non-delete content/pickup mutation, redirect (303) instead of re-rendering, so a refresh cannot duplicate an "Add". After any restore, the list shows a plain confirmation.

- [ ] **Step 1: content/index.astro — redirect after create/update/move**

In the POST handler (`src/pages/admin/content/index.astro:25-39`), replace the `banner = ...` assignments for create/update/move with redirects, and add an empty-title redirect:

```ts
    if (act === 'create' && v.title !== '') {
      await createContentBlock(env.DB, v);
      return Astro.redirect('/admin/content?saved=added', 303);
    } else if (act === 'update' && Number.isInteger(id) && v.title !== '') {
      await updateContentBlock(env.DB, id, v);
      return Astro.redirect('/admin/content?saved=saved', 303);
    } else if (act === 'delete' && Number.isInteger(id)) {
      await softDeleteContentBlock(env.DB, id, new Date().toISOString());
      return Astro.redirect(`/admin/content?undo=${id}`, 303);
    } else if ((act === 'move_up' || act === 'move_down') && Number.isInteger(id)) {
      await moveContentBlock(env.DB, id, act === 'move_up' ? 'up' : 'down');
      return Astro.redirect('/admin/content?saved=moved', 303);
    } else if (v.title === '' && (act === 'create' || act === 'update')) {
      return Astro.redirect('/admin/content?error=title', 303);
    }
```

Then delete the top-of-file `let banner = '';` and derive the banner from the query near where `undoId` is computed:

```ts
const url = new URL(Astro.request.url);
const undoRaw = url.searchParams.get('undo');
const undoId = undoRaw && /^\d+$/.test(undoRaw) ? undoRaw : null;
const saved = url.searchParams.get('saved');
const banner = saved === 'added' ? 'Added.' : saved === 'saved' ? 'Saved.' : saved === 'moved' ? 'Moved.'
  : url.searchParams.get('error') === 'title' ? 'Please give the item a title before saving.'
  : url.searchParams.get('restored') === '1' ? 'It\'s back in your list.' : '';
```

- [ ] **Step 2: content/[id]/restore.ts — redirect with `?restored=1`**

Change its redirect target from `/admin/content` to `/admin/content?restored=1`.

- [ ] **Step 3: pickup/index.astro — mirror Step 1** for its create/update/move (and `save_text`) branches, redirecting to `/admin/pickup?saved=...`; derive banner incl. `restored=1` → "It's back in your list."; keep the existing text-save branch redirecting to `/admin/pickup?saved=saved`.

- [ ] **Step 4: pickup/[id]/restore.ts — redirect `/admin/pickup?restored=1`**

- [ ] **Step 5: applications/[id]/restore.ts — redirect `/admin/applications?restored=1`**

```ts
  if (ok && Number.isInteger(id)) await restoreApplication(locals.runtime.env.DB, id);
  return redirect('/admin/applications?restored=1', 303);
```

- [ ] **Step 6: applications/index.astro — show restored banner**

Near the `undoId` derivation, add a restored banner above the list:

```astro
{new URL(Astro.request.url).searchParams.get('restored') === '1' && (
  <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">It's back in your list.</p></div>
)}
```

- [ ] **Step 7: Verify build + typecheck + suite**

Run: `npm run build` then `npx tsc --noEmit` then `npm run test`
Expected: build Complete!, tsc clean, tests green.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/content src/pages/admin/pickup src/pages/admin/applications/[id]/restore.ts src/pages/admin/applications/index.astro
git commit -m "fix: PRG on news/pickup edits and restore confirmation banners"
```

---

### Task 11: Serve the paper application PDF without caching + record decisions

**Files:**
- Modify: `src/pages/application.pdf.ts:22`
- Modify: `docs/decisions.md` (tick off the delivered Plan 3c items)

**Interfaces:** none.

- [ ] **Step 1: Change the Cache-Control header** (`src/pages/application.pdf.ts`)

```ts
        'Cache-Control': 'no-cache',
```

Rationale: after the operator uploads a new PDF at `/admin/paper-application`, the public download should reflect it immediately, not up to 5 minutes later.

- [ ] **Step 2: Update `docs/decisions.md`** — under the "Plan 3c binding notes" section, add a short line noting which items this plan delivered (full-parity editing; PRG on approve/deny and news/pickup; undo/restore banners; CSRF/validation banners; single-statement assignPuNumber; LIKE escaping; fuller export honoring q; no-cache PDF). Leave donations/donor directory/contact-messages as Plan 3d.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build Complete!.

- [ ] **Step 4: Commit**

```bash
git add src/pages/application.pdf.ts docs/decisions.md
git commit -m "fix: serve the paper application PDF with no-cache; record Plan 3c completion"
```

---

## Self-Review

**1. Spec coverage:**
- Full-parity editing → T3 (details incl. income/benefits/confirmations/good-deed/eligibility), T4 (members add/edit/remove), T5 (employers add/edit/remove). ✓
- Three detail-page editor buttons → T4/T5. ✓
- Hard-delete-with-confirm for members/employers → T4/T5 (`data-confirm`, no soft-delete). ✓
- `application_id`-scoped child edits/deletes → T1/T2 (`WHERE id = ? AND application_id = ?`) + tests. ✓
- PRG on approve/deny → T6; PRG on news/pickup → T10. ✓
- Undo/restore banners → T10. ✓
- CSRF-failure + validation banners → T3 (edit), T4/T5 (editors), T6 (detail). ✓
- Single-statement `assignPuNumber` → T7. ✓
- LIKE escaping → T8. ✓
- Fuller export + honor `q` → T9. ✓
- `/application.pdf` no-cache → T11. ✓
- `updateApplicationCore` replaced by `updateApplicationFull` → T3 (removed, sole caller updated). ✓
- TDD for db helpers → T1, T2, T3, T7, T8, T9 all lead with a failing test. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. T10 Step 3 says "mirror Step 1" but Step 1 gives the exact pattern and the pickup file is the known twin — acceptable as it repeats the full pattern to copy. ✓

**3. Type consistency:** `MemberEdit`, `EmployerEdit`, `ApplicationFullEdit` used identically across their producing task and consuming pages. `escapeLike` defined in T8, consumed in T9. `listApplicationsForExport` signature gains `search: string` in T9 and its sole caller (export.csv.ts) is updated in the same task. `assignPuNumber` keeps its signature (T7). ✓

**Note for the executor:** the export `?2`-when-`'all'` binding is resolved in T9 Step 3b — always bind `(seasonYear, status === 'all' ? '' : status, like)` so `?1/?2/?3` are all bound; `?2` is simply unreferenced in the `'all'` SQL. D1 permits binding an unreferenced numbered parameter.
