# Application Relationships & Eligibility-Review Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the online application capture — clearly and per person — the household relationship, disability, sizes, and blended-family facts the operator hand-calculates eligibility from, and surface them in the admin and Excel export, without the software ever deciding eligibility.

**Architecture:** Add a new schema migration (`0003`) with `ALTER TABLE` columns; a small pure `relationships.ts` lib for the relationship option set + label mapping; extend the pure validation layer, then the D1 data layer, then the applicant form, then the admin views. Logic (validation, DB) is TDD'd; Astro UI is verified by `npm run build` + the shared field names the validation tests already pin.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Tailwind 4, Cloudflare D1 (SQLite), Vitest, wrangler 4. Node ≥22. Tests via `npm test` (`vitest run`); build via `npm run build` (`astro build`).

## Global Constraints

- Applicant form stays mobile-first, low reading level, works at 360px; every new field is justified and optional where possible.
- **The form must work with JavaScript disabled.** No new field may depend on JS to appear or submit — no conditional reveal; new questions are always visible and clearly optional.
- Never wipe what the applicant typed on a validation error (existing POST re-render preserves `values`).
- The software **never decides eligibility and never auto-denies**; it only captures and displays relationship/disability/income for the operator's manual decision.
- Admin base font ≥18px, plain English, text-labeled buttons; every mutating admin POST enforces CSRF; admin responses `Cache-Control: no-store`.
- Straight apostrophes only in code copy. CSP: no inline handlers/scripts (external `apply.js` only).
- PII never logged in plaintext, never exposed on a public route. `admin_notes` is admin-only.
- `245 W. Elm St.` stays everywhere it currently appears; the operator's home address (`807 E. Cherry St.`) must never appear anywhere on the site.
- Relationship canonical values (used by form, validation, DB, admin): `self`, `other_parent`, `son`, `daughter`, `grandchild`, `court`, `not_related`, `other`.

---

## Task 1: Schema migration, test harness, relationships lib

**Files:**
- Create: `migrations/0003_relationships.sql`
- Modify: `tests/helpers/d1.ts`
- Create: `src/lib/relationships.ts`
- Create: `tests/relationships.test.ts`
- Modify: `tests/d1-schema.test.ts` (add one case)

**Interfaces:**
- Produces: `RELATIONSHIP_OPTIONS: readonly { value: string; label: string }[]`, `RELATIONSHIP_VALUES: Set<string>`, `relationshipLabel(value: string, other?: string): string`, `NON_FAMILY_RELATIONSHIPS: Set<string>` from `src/lib/relationships.ts`.
- Produces: new columns `household_members.relationship_other/disabled/part_time/shoe/coat`, `applications.parentage_note/admin_notes`.

- [ ] **Step 1: Write the migration file**

Create `migrations/0003_relationships.sql`:

```sql
-- Plan 5: per-person relationship/disability/sizes, blended-family + admin notes.
-- Run ONCE against the live DB with `npm run db:migrate:remote`. Fresh DBs (tests)
-- get these via tests/helpers/d1.ts, which applies this file after 0001.
ALTER TABLE household_members ADD COLUMN relationship_other TEXT NOT NULL DEFAULT '';
ALTER TABLE household_members ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_members ADD COLUMN part_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_members ADD COLUMN shoe TEXT NOT NULL DEFAULT '';
ALTER TABLE household_members ADD COLUMN coat TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN parentage_note TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN admin_notes TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 2: Update the test harness to apply 0003 after 0001**

In `tests/helpers/d1.ts`, replace the single-file read/apply block (the `const sql = readFileSync('migrations/0001_init.sql', ...)` loop) with a loop over both schema files that also strips `--` comment lines (0003 has them):

```ts
  for (const file of ['migrations/0001_init.sql', 'migrations/0003_relationships.sql']) {
    const sql = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l: string) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql.split(';').map((s: string) => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run();
    }
  }
```

(Leave the `INSERT INTO cities ...` and `INSERT INTO settings ...` seed lines and the rest of the function unchanged.)

- [ ] **Step 3: Write the relationships lib**

Create `src/lib/relationships.ts`:

```ts
// The household relationship options, shared by the applicant form, validation,
// the admin views, and the export. Values are stored in household_members.relationship.
export const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Myself (head of household)' },
  { value: 'other_parent', label: 'The other parent' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'court', label: 'Court-appointed (foster child or guardianship)' },
  { value: 'not_related', label: 'Not related (boyfriend, roommate, other adult)' },
  { value: 'other', label: 'Other' },
] as const;

export const RELATIONSHIP_VALUES = new Set(RELATIONSHIP_OPTIONS.map((o) => o.value));

// Adults who are not part of the eligible immediate family. Drives the admin
// "please verify" review tag only — it never blocks or denies anything.
export const NON_FAMILY_RELATIONSHIPS = new Set(['not_related']);

// Human label for a stored relationship value. Falls back to the raw value so
// legacy/imported rows (blank or free-text) still render sensibly.
export function relationshipLabel(value: string, other = ''): string {
  if (value === 'other') return other.trim() || 'Other';
  const found = RELATIONSHIP_OPTIONS.find((o) => o.value === value);
  if (found) return found.label;
  return value.trim() || '—';
}
```

- [ ] **Step 4: Write failing tests for the lib**

Create `tests/relationships.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  RELATIONSHIP_OPTIONS, RELATIONSHIP_VALUES, NON_FAMILY_RELATIONSHIPS, relationshipLabel,
} from '../src/lib/relationships';

describe('relationships lib', () => {
  it('exposes the eight canonical values', () => {
    expect([...RELATIONSHIP_VALUES]).toEqual([
      'self', 'other_parent', 'son', 'daughter', 'grandchild', 'court', 'not_related', 'other',
    ]);
    expect(RELATIONSHIP_OPTIONS).toHaveLength(8);
  });
  it('maps a code to its label', () => {
    expect(relationshipLabel('son')).toBe('Son');
    expect(relationshipLabel('not_related')).toContain('Not related');
  });
  it('uses the other text when value is other', () => {
    expect(relationshipLabel('other', 'Niece')).toBe('Niece');
    expect(relationshipLabel('other', '')).toBe('Other');
  });
  it('falls back to raw value for legacy data, and dash for blank', () => {
    expect(relationshipLabel('grandma')).toBe('grandma');
    expect(relationshipLabel('')).toBe('—');
  });
  it('flags only not_related as non-family', () => {
    expect(NON_FAMILY_RELATIONSHIPS.has('not_related')).toBe(true);
    expect(NON_FAMILY_RELATIONSHIPS.has('son')).toBe(false);
  });
});
```

- [ ] **Step 5: Add a schema case proving the new columns exist**

In `tests/d1-schema.test.ts`, add this test inside the `describe('D1 schema integrity', ...)` block:

```ts
  it('accepts a member row using the new relationship/disability/size columns', async () => {
    const app = await db
      .prepare(
        `INSERT INTO applications (season_year, submitted_at, first_name, last_name, address, city_id, phone, email)
         VALUES (2026, '2026-10-01T00:00:00Z', 'A', 'B', '1 Elm', 13, '555', 'a@b.co')`,
      )
      .run();
    const appId = app.meta.last_row_id;
    const res = await db
      .prepare(
        `INSERT INTO household_members
           (application_id, position, name, relationship, relationship_other, sex, age, disabled, part_time, shoe, coat)
         VALUES (?, 1, 'Kid', 'not_related', '', 'M', 30, 1, 1, '10', 'L')`,
      )
      .bind(appId)
      .run();
    expect(res.meta.last_row_id).toBeGreaterThan(0);
    const back = await db
      .prepare('SELECT disabled, part_time, shoe, coat, relationship FROM household_members WHERE application_id = ?')
      .bind(appId)
      .first<{ disabled: number; part_time: number; shoe: string; coat: string; relationship: string }>();
    expect(back).toMatchObject({ disabled: 1, part_time: 1, shoe: '10', coat: 'L', relationship: 'not_related' });
  });
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all green, including the new `relationships` and schema cases. (The whole suite must pass — the harness change affects every DB test.)

- [ ] **Step 7: Commit**

```bash
git add migrations/0003_relationships.sql tests/helpers/d1.ts src/lib/relationships.ts tests/relationships.test.ts tests/d1-schema.test.ts
git commit -m "feat(schema): plan-5 columns + relationships lib + harness applies 0003"
```

---

## Task 2: Validation layer

**Files:**
- Modify: `src/lib/validation/application.ts`
- Modify: `tests/application-validation-household.test.ts`
- Modify: `tests/application-validation-about.test.ts`

**Interfaces:**
- Consumes: `RELATIONSHIP_VALUES` from `src/lib/relationships.ts`.
- Produces: `MemberClean` gains optional `relationshipOther`, `disabled`, `partTime`, `shoe`, `coat`; `AboutClean` loses `permanentlyDisabled`; `CleanApplication` gains `permanentlyDisabled: boolean` (derived) and optional `parentageNote`; new `validateParentageNote(input, errors): string | null`.

**Note on optional fields:** the five new member fields and `parentageNote` are typed **optional** so the many existing `NewApplication`/`MemberClean` test fixtures keep compiling without edits; the validator always populates them, and the DB layer (Task 3) defaults any that are absent.

- [ ] **Step 1: Write failing validation tests**

In `tests/application-validation-household.test.ts`, add to the `describe('validateMembers', ...)` block:

```ts
  it('captures disabled, part-time, shoe, coat and requires a valid relationship code', () => {
    const errors: Errors = {};
    const r = validateMembers({
      ...fullValid,
      member_disabled_2: 'on', member_part_time_2: 'on', member_shoe_2: '2', member_coat_2: '10',
    }, errors);
    expect(errors).toEqual({});
    expect(r?.[1]).toMatchObject({ disabled: true, partTime: true, shoe: '2', coat: '10' });
  });

  it('rejects an unknown relationship and requires text when relationship is other', () => {
    const e1: Errors = {};
    validateMembers({ ...fullValid, member_relationship_2: 'banana' }, e1);
    expect(e1.member_relationship_2).toBeTruthy();
    const e2: Errors = {};
    validateMembers({ ...fullValid, member_relationship_2: 'other', member_relationship_other_2: '' }, e2);
    expect(e2.member_relationship_other_2).toBeTruthy();
    const e3: Errors = {};
    const r = validateMembers({ ...fullValid, member_relationship_2: 'other', member_relationship_other_2: 'Niece' }, e3);
    expect(e3).toEqual({});
    expect(r?.[1]).toMatchObject({ relationship: 'other', relationshipOther: 'Niece' });
  });
```

In the `describe('validateApplication', ...)` block, add:

```ts
  it('derives permanentlyDisabled from members and carries the parentage note', () => {
    const r = validateApplication({ ...fullValid, member_disabled_1: 'on', parentage_note: 'Tim is my son only.' });
    expect(r.ok).toBe(true);
    if (r.ok && !r.spam) {
      expect(r.clean.permanentlyDisabled).toBe(true);
      expect(r.clean.parentageNote).toBe('Tim is my son only.');
    }
  });

  it('permanentlyDisabled is false when no member is marked disabled', () => {
    const r = validateApplication(fullValid);
    if (r.ok && !r.spam) expect(r.clean.permanentlyDisabled).toBe(false);
  });
```

- [ ] **Step 2: Update the about test for the removed household disabled question**

In `tests/application-validation-about.test.ts`:
1. In the `expect(clean).toEqual({ ... })` object (the "returns clean data" test), **remove** the `permanentlyDisabled: false,` line.
2. In the "requires each required field" test's array, **remove** the `'permanently_disabled',` entry.

(Leave `permanently_disabled: 'no'` in the `goodAbout` fixture; it is now an ignored extra key.)

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npm test`
Expected: FAIL — the new member/derive assertions fail, and about test fails until the source is updated.

- [ ] **Step 4: Update the validation source**

In `src/lib/validation/application.ts`:

(a) Add the import at the top (after the header comment):

```ts
import { RELATIONSHIP_VALUES } from '../relationships';
```

(b) In `AboutClean`, **remove** the `permanentlyDisabled: boolean;` field. In `validateAbout`, **remove** the disabled block:

```ts
  const disabled = get(input, 'permanently_disabled');
  if (disabled !== 'yes' && disabled !== 'no') {
    errors.permanently_disabled = 'Please answer yes or no.';
  }
```

remove `'permanently_disabled'` from the `mine` array, and remove `permanentlyDisabled: disabled === 'yes',` from the returned object.

(c) Replace `MemberClean` and `validateMembers` with:

```ts
export type MemberClean = {
  name: string;
  relationship: string;
  relationshipOther?: string;
  sex: 'M' | 'F';
  age: number;
  disabled?: boolean;
  partTime?: boolean;
  pants: string;
  shirtTop: string;
  underwear: string;
  socks: string;
  diapers: string;
  shoe?: string;
  coat?: string;
  gifts: string;
};

export function validateMembers(input: ApplicationInput, errors: Errors): MemberClean[] | null {
  const count = rowCount(input, 'member_count', MAX_MEMBERS);
  const members: MemberClean[] = [];
  let failed = false;

  for (let i = 1; i <= count; i++) {
    const name = get(input, `member_name_${i}`);
    const relationship = get(input, `member_relationship_${i}`);
    const relationshipOther = get(input, `member_relationship_other_${i}`);
    const sex = get(input, `member_sex_${i}`);
    const ageRaw = get(input, `member_age_${i}`);
    const disabled = isOn(input, `member_disabled_${i}`);
    const partTime = isOn(input, `member_part_time_${i}`);
    const sizes = {
      pants: get(input, `member_pants_${i}`),
      shirtTop: get(input, `member_shirt_${i}`),
      underwear: get(input, `member_underwear_${i}`),
      socks: get(input, `member_socks_${i}`),
      diapers: get(input, `member_diapers_${i}`),
      shoe: get(input, `member_shoe_${i}`),
      coat: get(input, `member_coat_${i}`),
    };
    const gifts = get(input, `member_gifts_${i}`);

    const allBlank =
      name === '' && relationship === '' && relationshipOther === '' && sex === '' && ageRaw === '' &&
      Object.values(sizes).every((s) => s === '') && gifts === '';
    if (allBlank && i > 1) continue; // blank extra card: skip

    if (name === '') errors[`member_name_${i}`] = "Please give this person's first and last name.";
    if (!RELATIONSHIP_VALUES.has(relationship)) {
      errors[`member_relationship_${i}`] = 'Please choose how this person is related to you.';
    } else if (relationship === 'other' && relationshipOther === '') {
      errors[`member_relationship_other_${i}`] = 'Please describe how this person is related to you.';
    }
    if (sex !== 'M' && sex !== 'F') errors[`member_sex_${i}`] = 'Please pick one.';
    const age = parseIntInRange(ageRaw, 0, 110);
    if (age === null) errors[`member_age_${i}`] = 'Please enter their age as a number.';

    if (
      errors[`member_name_${i}`] || errors[`member_relationship_${i}`] || errors[`member_relationship_other_${i}`] ||
      errors[`member_sex_${i}`] || errors[`member_age_${i}`]
    ) {
      failed = true;
      continue;
    }
    members.push({
      name, relationship, relationshipOther, sex: sex as 'M' | 'F', age: age as number,
      disabled, partTime, ...sizes, gifts,
    });
  }

  if (failed) return null;
  return members;
}
```

(d) Add `validateParentageNote` (near `validateGoodDeed`):

```ts
export function validateParentageNote(input: ApplicationInput, errors: Errors): string | null {
  const note = get(input, 'parentage_note');
  if (note.length > 2000) {
    errors.parentage_note = "That's a little long — please shorten it to the key details.";
    return null;
  }
  return note;
}
```

(e) Replace `CleanApplication` and `validateApplication` with:

```ts
export type CleanApplication = AboutClean &
  BeddingClean & {
    noEmploymentConfirmed: boolean;
    employers: EmployerClean[];
    benefits: BenefitsClean;
    members: MemberClean[];
    goodDeed: string;
    permanentlyDisabled: boolean;
    parentageNote?: string;
  };

export function validateApplication(input: ApplicationInput): ApplicationResult {
  if ((input.website ?? '').trim() !== '') return { ok: true, spam: true };

  const errors: Errors = {};
  const about = validateAbout(input, errors);
  const bedding = validateBedding(input, errors);
  const employment = validateEmployment(input, errors);
  const benefits = validateBenefits(input, errors);
  const members = validateMembers(input, errors);
  const goodDeed = validateGoodDeed(input, errors);
  const parentageNote = validateParentageNote(input, errors);

  if (!about || !bedding || !employment || !benefits || !members || goodDeed === null || parentageNote === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    spam: false,
    clean: {
      ...about, ...bedding, ...employment, benefits, members, goodDeed,
      permanentlyDisabled: members.some((m) => m.disabled === true),
      parentageNote,
    },
  };
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm test`
Expected: PASS (whole suite green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/application.ts tests/application-validation-household.test.ts tests/application-validation-about.test.ts
git commit -m "feat(validation): per-member relationship/disability/sizes, parentage note, derived disabled flag"
```

---

## Task 3: Data layer (db.ts)

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `tests/db-members.test.ts`
- Modify: `tests/db-admin-export.test.ts`
- Create: `tests/db-application-relationships.test.ts`

**Interfaces:**
- Consumes: `CleanApplication`/`MemberClean` (Task 2). 
- Produces: `insertApplication`/`insertMember`/`updateMember` persist the new columns; `MemberEdit` gains optional `relationshipOther/disabled/partTime/shoe/coat`; `setApplicationNotes(db, id, notes)`; `updateApplicationFull`/`ApplicationFullEdit` gain `parentageNote`; `ExportRow` gains `parentage_note/admin_notes` and a richer `member_summary`.

- [ ] **Step 1: Write failing DB tests**

Create `tests/db-application-relationships.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, setApplicationNotes, updateApplicationFull,
  type NewApplication, type ApplicationFullEdit,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [
    { name: 'Sue', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Jim', relationship: 'not_related', relationshipOther: '', sex: 'M', age: 38, disabled: true, partTime: false, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', shoe: '11', coat: 'XL', gifts: '' },
  ],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
  parentageNote: 'Jim is nobody’s parent.',
};

describe('application relationships persistence', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('round-trips new member fields and the parentage note', async () => {
    const id = await insertApplication(db, base);
    const detail = await getApplicationDetail(db, id);
    expect(detail!.app.parentage_note).toBe('Jim is nobody’s parent.');
    const jim = detail!.members[1];
    expect(jim.relationship).toBe('not_related');
    expect(jim.disabled).toBe(1);
    expect(jim.shoe).toBe('11');
    expect(jim.coat).toBe('XL');
  });

  it('saves admin notes and an edited parentage note', async () => {
    const id = await insertApplication(db, base);
    await setApplicationNotes(db, id, 'Boyfriend excluded; gave gift card.');
    const edit: ApplicationFullEdit = {
      firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
      diabetic: false, shareWithSponsor: false, permanentlyDisabled: false, bedChoice: 'none', bedSize: null,
      yearsReceivedHelp: 0, adoptedLastYear: false, householdType: 'family', fullTimeResidenceConfirmed: true,
      noEmploymentConfirmed: true, foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '',
      ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null,
      unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '', goodDeed: 'x', mayNotBeEligible: false,
      parentageNote: 'Edited note.',
    };
    await updateApplicationFull(db, id, edit);
    const detail = await getApplicationDetail(db, id);
    expect(detail!.app.admin_notes).toBe('Boyfriend excluded; gave gift card.');
    expect(detail!.app.parentage_note).toBe('Edited note.');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — `setApplicationNotes` not exported; `ApplicationFullEdit.parentageNote` missing; new member columns not written.

- [ ] **Step 3: Update `insertApplication` (applications + members INSERTs)**

In `src/lib/db.ts` `insertApplication`, change the applications INSERT column list ending and its bind. Append `, parentage_note` to the column list (right after `may_not_be_eligible`), add one `?` to the VALUES list, and add `app.parentageNote ?? ''` as the final bind (after `app.mayNotBeEligible ? 1 : 0,`):

```ts
         good_deed, may_not_be_eligible, parentage_note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
```
```ts
      app.goodDeed, app.mayNotBeEligible ? 1 : 0, app.parentageNote ?? '',
```

Replace the members `.map(...)` INSERT with the new columns:

```ts
    ...app.members.map((m, i) =>
      db
        .prepare(
          `INSERT INTO household_members
             (application_id, position, name, relationship, relationship_other, sex, age,
              disabled, part_time, pants, shirt_top, underwear, socks, diapers, shoe, coat, gifts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          appId, i + 1, m.name, m.relationship, m.relationshipOther ?? '', m.sex, m.age,
          m.disabled ? 1 : 0, m.partTime ? 1 : 0,
          m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.shoe ?? '', m.coat ?? '', m.gifts,
        ),
    ),
```

- [ ] **Step 4: Update `MemberEdit`, `insertMember`, `updateMember`**

Replace the `MemberEdit` type:

```ts
export type MemberEdit = {
  name: string; relationship: string; relationshipOther?: string; sex: string; age: number;
  disabled?: boolean; partTime?: boolean;
  pants: string; shirtTop: string; underwear: string; socks: string; diapers: string; shoe?: string; coat?: string; gifts: string;
};
```

In `insertMember`, change the INSERT + bind:

```ts
    .prepare(
      `INSERT INTO household_members
         (application_id, position, name, relationship, relationship_other, sex, age,
          disabled, part_time, pants, shirt_top, underwear, socks, diapers, shoe, coat, gifts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      applicationId, (max?.m ?? 0) + 1, m.name, m.relationship, m.relationshipOther ?? '', m.sex, m.age,
      m.disabled ? 1 : 0, m.partTime ? 1 : 0,
      m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.shoe ?? '', m.coat ?? '', m.gifts,
    )
```

In `updateMember`, change the UPDATE + bind:

```ts
    .prepare(
      `UPDATE household_members SET
         name = ?, relationship = ?, relationship_other = ?, sex = ?, age = ?,
         disabled = ?, part_time = ?,
         pants = ?, shirt_top = ?, underwear = ?, socks = ?, diapers = ?, shoe = ?, coat = ?, gifts = ?
       WHERE id = ? AND application_id = ?`,
    )
    .bind(
      m.name, m.relationship, m.relationshipOther ?? '', m.sex, m.age,
      m.disabled ? 1 : 0, m.partTime ? 1 : 0,
      m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.shoe ?? '', m.coat ?? '', m.gifts, id, applicationId,
    )
```

- [ ] **Step 5: Add `setApplicationNotes` and extend `updateApplicationFull`**

Add near `setBagsCount`:

```ts
export async function setApplicationNotes(db: D1Database, id: number, notes: string): Promise<void> {
  await db.prepare('UPDATE applications SET admin_notes = ? WHERE id = ?').bind(notes, id).run();
}
```

In `ApplicationFullEdit`, add `parentageNote: string;` (after `goodDeed`). In `updateApplicationFull`, add `parentage_note = ?` to the SET list (after `good_deed = ?`) and `f.parentageNote` to the bind (after `f.goodDeed,`):

```ts
         good_deed = ?, parentage_note = ?, may_not_be_eligible = ?
```
```ts
      f.goodDeed, f.parentageNote, f.mayNotBeEligible ? 1 : 0,
```

- [ ] **Step 6: Update `ExportRow` + `listApplicationsForExport`**

Add to `ExportRow`: `parentage_note: string;` and `admin_notes: string;` (anywhere in the type). In `listApplicationsForExport` SQL, add `a.parentage_note, a.admin_notes,` to the SELECT (e.g. right after `a.may_not_be_eligible, a.bags_count,`) and replace the `member_summary` expression with:

```sql
           COALESCE(GROUP_CONCAT(
             m.name || ' (' ||
             CASE m.relationship
               WHEN 'self' THEN 'self'
               WHEN 'other_parent' THEN 'parent'
               WHEN 'son' THEN 'son'
               WHEN 'daughter' THEN 'daughter'
               WHEN 'grandchild' THEN 'grandchild'
               WHEN 'court' THEN 'court-appointed'
               WHEN 'not_related' THEN 'not related'
               WHEN 'other' THEN COALESCE(NULLIF(m.relationship_other, ''), 'other')
               ELSE COALESCE(NULLIF(m.relationship, ''), '?')
             END
             || ', age ' || m.age ||
             CASE WHEN m.disabled = 1 THEN ', disabled' ELSE '' END ||
             CASE WHEN m.part_time = 1 THEN ', part-time' ELSE '' END ||
             ')', '; '), '') AS member_summary,
```

- [ ] **Step 7: Update the export test expectations**

In `tests/db-admin-export.test.ts`, the "all branch and summarizes members" test currently expects `member_summary` to contain `'Sue Smith (40)'` and `'Tim Smith (7)'`. Change those to:

```ts
    expect(rows[0].member_summary).toContain('Sue Smith (self, age 40)');
    expect(rows[0].member_summary).toContain('Tim Smith (son, age 7)');
```

- [ ] **Step 8: Update the `kid()` fixture in db-members**

In `tests/db-members.test.ts`, the `kid()` helper returns a `MemberEdit`. Its `relationship: 'child'` stays (legacy free-text is allowed at the DB layer). No new fields are required (they are optional), so no change is strictly needed — but add `disabled: false` to one assertion is unnecessary. Leave `tests/db-members.test.ts` unchanged unless the compiler complains; the optional fields keep it valid.

- [ ] **Step 9: Run the tests**

Run: `npm test`
Expected: PASS (whole suite green).

- [ ] **Step 10: Commit**

```bash
git add src/lib/db.ts tests/db-application-relationships.test.ts tests/db-admin-export.test.ts
git commit -m "feat(db): persist member relationship/disability/sizes, parentage + admin notes, export"
```

---

## Task 4: Applicant form

**Files:**
- Modify: `src/components/apply/MemberCard.astro`
- Modify: `src/pages/apply.astro`

**Interfaces:**
- Consumes: `RELATIONSHIP_OPTIONS` from `src/lib/relationships.ts`. Field names must match Task 2 exactly: `member_relationship_{i}`, `member_relationship_other_{i}`, `member_disabled_{i}`, `member_part_time_{i}`, `member_shoe_{i}`, `member_coat_{i}`, and application-level `parentage_note`.

- [ ] **Step 1: Replace `MemberCard.astro`**

Replace `src/components/apply/MemberCard.astro` with:

```astro
---
import FieldError from './FieldError.astro';
import { RELATIONSHIP_OPTIONS } from '../../lib/relationships';
interface Props { index: number | string; values: Record<string, string>; errors: Record<string, string> }
const { index: i, values, errors } = Astro.props;
const v = (n: string) => values[n] ?? '';
const inv = (n: string) => (errors[n] ? 'true' : undefined);
const desc = (n: string) => (errors[n] ? `${n}-error` : undefined);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3';
const sizes = [
  { field: `member_pants_${i}`, label: 'Pants size' },
  { field: `member_shirt_${i}`, label: 'Shirt/top size' },
  { field: `member_underwear_${i}`, label: 'Underwear size' },
  { field: `member_socks_${i}`, label: 'Socks size' },
  { field: `member_shoe_${i}`, label: 'Shoe size' },
  { field: `member_coat_${i}`, label: 'Coat size' },
  { field: `member_diapers_${i}`, label: 'Diapers size' },
];
---
<fieldset class="mt-4 rounded border-2 border-stone-300 bg-white p-4">
  <legend class="px-2 font-bold">Person {i}{i === 1 || i === '1' ? ' — you' : ''}</legend>
  <div class="grid gap-4 sm:grid-cols-2">
    <div>
      <label for={`member_name_${i}`} class="block font-semibold">First and last name</label>
      <input type="text" id={`member_name_${i}`} name={`member_name_${i}`} value={v(`member_name_${i}`)}
        aria-invalid={inv(`member_name_${i}`)} aria-describedby={desc(`member_name_${i}`)} class={input} />
      <FieldError id={`member_name_${i}`} errors={errors} />
    </div>
    <div>
      <label for={`member_relationship_${i}`} class="block font-semibold">How are they related to you?</label>
      <select id={`member_relationship_${i}`} name={`member_relationship_${i}`}
        aria-invalid={inv(`member_relationship_${i}`)} aria-describedby={desc(`member_relationship_${i}`)} class={input}>
        <option value="">— Choose one —</option>
        {RELATIONSHIP_OPTIONS.map((o) => (
          <option value={o.value} selected={v(`member_relationship_${i}`) === o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError id={`member_relationship_${i}`} errors={errors} />
      <label for={`member_relationship_other_${i}`} class="mt-2 block text-base">If you chose "Other," describe it here</label>
      <input type="text" id={`member_relationship_other_${i}`} name={`member_relationship_other_${i}`} value={v(`member_relationship_other_${i}`)}
        aria-invalid={inv(`member_relationship_other_${i}`)} aria-describedby={desc(`member_relationship_other_${i}`)} class={input} />
      <FieldError id={`member_relationship_other_${i}`} errors={errors} />
    </div>
    <fieldset id={`member_sex_${i}`} tabindex="-1">
      <legend class="font-semibold">Sex</legend>
      <div class="mt-1 flex gap-6">
        <label class="flex items-center gap-2"><input type="radio" name={`member_sex_${i}`} value="M" checked={v(`member_sex_${i}`) === 'M'} aria-invalid={inv(`member_sex_${i}`)} aria-describedby={desc(`member_sex_${i}`)} class="h-6 w-6" /> Male</label>
        <label class="flex items-center gap-2"><input type="radio" name={`member_sex_${i}`} value="F" checked={v(`member_sex_${i}`) === 'F'} aria-invalid={inv(`member_sex_${i}`)} aria-describedby={desc(`member_sex_${i}`)} class="h-6 w-6" /> Female</label>
      </div>
      <FieldError id={`member_sex_${i}`} errors={errors} />
    </fieldset>
    <div>
      <label for={`member_age_${i}`} class="block font-semibold">Age</label>
      <input type="text" inputmode="numeric" id={`member_age_${i}`} name={`member_age_${i}`} value={v(`member_age_${i}`)}
        aria-invalid={inv(`member_age_${i}`)} aria-describedby={desc(`member_age_${i}`)} class="mt-1 w-24 rounded border-2 border-stone-400 bg-white p-3" />
      <FieldError id={`member_age_${i}`} errors={errors} />
    </div>
  </div>
  <div class="mt-4 space-y-3">
    <label class="flex items-start gap-3">
      <input type="checkbox" name={`member_disabled_${i}`} checked={v(`member_disabled_${i}`) === 'on'} class="mt-1 h-6 w-6" />
      <span>This person is permanently disabled</span>
    </label>
    <label class="flex items-start gap-3">
      <input type="checkbox" name={`member_part_time_${i}`} checked={v(`member_part_time_${i}`) === 'on'} class="mt-1 h-6 w-6" />
      <span>This person lives in my home only part of the time</span>
    </label>
  </div>
  <p class="mt-4 font-semibold">Clothing sizes <span class="font-normal">(leave blank anything they don't need)</span></p>
  <div class="mt-1 grid gap-4 sm:grid-cols-3">
    {sizes.map((s) => (
      <div>
        <label for={s.field} class="block">{s.label}</label>
        <input type="text" id={s.field} name={s.field} value={v(s.field)} class={input} />
      </div>
    ))}
  </div>
  <div class="mt-4">
    <label for={`member_gifts_${i}`} class="block font-semibold">Gifts or toys they'd like</label>
    <textarea id={`member_gifts_${i}`} name={`member_gifts_${i}`} rows="3" class={input}>{v(`member_gifts_${i}`)}</textarea>
    <p class="mt-1 text-base text-stone-600">We can't provide expensive items like iPods, laptops, games, or TVs.</p>
  </div>
</fieldset>
```

- [ ] **Step 2: Remove the household disabled question in `apply.astro`**

In `src/pages/apply.astro`, **delete** the entire `permanently_disabled` fieldset block (the `<fieldset id="permanently_disabled" ...> ... </fieldset>` covering "Is anyone in your household permanently disabled?" and its `<FieldError id="permanently_disabled" ... />`).

- [ ] **Step 3: Reword the residence confirmation in `apply.astro`**

Change the `full_time_residence` checkbox's span text from "Everyone I list on this application lives at my address full-time" to:

```astro
              <span>Everyone I have listed lives in my home (children live here at least half of the time)</span>
```

- [ ] **Step 4: Add the "apply to only one project" notice in `apply.astro`**

Directly after the "A note on who this program serves" paragraph (the `<p class="mt-4">...apply anyway — a volunteer will look...</p>`), add:

```astro
      <p class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4 text-base">
        Please apply to only one holiday project in Grant County. Applicant names are shared among the
        county's projects, so applying in more than one place can hold up your gifts.
      </p>
```

- [ ] **Step 5: Add the parentage note + residence sentence to the Household section in `apply.astro`**

In the `<section aria-labelledby="s-household">`, change the intro `<p class="mt-2">Tell us about each person...</p>` to add the residence sentence:

```astro
          <p class="mt-2">
            Tell us about each person living with you, including yourself — you're Person 1. Children
            must live in your home at least half of the time to be listed. Clothing sizes help us pick
            things that fit; leave blank anything they don't need.
          </p>
```

Then, after the "+ Add another person" button (`</button>` that closes the add-member button, before `</section>`), add the optional parentage note:

```astro
          <div class="mt-6">
            <label for="parentage_note" class="block font-semibold">
              Blended families <span class="font-normal">(optional)</span>
            </label>
            <p class="text-base text-stone-600">
              If a partner or another adult in your home is a parent of only some of your children,
              tell us which children are theirs. Leave blank if this does not apply.
            </p>
            <textarea id="parentage_note" name="parentage_note" rows="3"
              aria-invalid={errors.parentage_note ? 'true' : undefined}
              aria-describedby={errors.parentage_note ? 'parentage_note-error' : undefined}
              class={input}>{values.parentage_note ?? ''}</textarea>
            <FieldError id="parentage_note" errors={errors} />
          </div>
```

- [ ] **Step 6: Fix the paper-application mailing instruction (both states)**

In `apply.astro`, there are two places that say to mail the paper application to `245 W. Elm St., Lancaster WI 53813`. In BOTH the closed-state block and the open-state "Rather not do this online?" block, change the paper-application line so it no longer names 245 W. Elm and instead points to the form's own address:

Closed state — change:
```astro
            <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a>
            and mail it to 245 W. Elm St., Lancaster WI 53813.
```
to:
```astro
            <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a>
            and mail it back to the address printed on the form.
```

Open state — change:
```astro
          <li>Or <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a> and mail it to 245 W. Elm St., Lancaster WI 53813.</li>
```
to:
```astro
          <li>Or <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a> and mail it back to the address printed on the form.</li>
```

- [ ] **Step 7: Build and test**

Run: `npm run build`
Expected: build succeeds with no type errors.

Run: `npm test`
Expected: PASS (validation from Task 2 already covers the new field names; nothing regressed).

- [ ] **Step 8: Commit**

```bash
git add src/components/apply/MemberCard.astro src/pages/apply.astro
git commit -m "feat(apply): relationship dropdown, per-person disabled/part-time, shoe/coat, parentage note, copy fixes"
```

---

## Task 5: Admin detail view

**Files:**
- Modify: `src/pages/admin/applications/[id].astro`

**Interfaces:**
- Consumes: `relationshipLabel`, `NON_FAMILY_RELATIONSHIPS` (relationships lib); `setApplicationNotes` (db). Reads `a.parentage_note`, `a.admin_notes`, and per-member `relationship`, `relationship_other`, `disabled`, `part_time`, `shoe`, `coat`.

- [ ] **Step 1: Add imports and the notes POST handler**

In `src/pages/admin/applications/[id].astro`:

Add to the `db` import list `setApplicationNotes`, and add a new import:

```ts
import { relationshipLabel, NON_FAMILY_RELATIONSHIPS } from '../../../lib/relationships';
```

In the POST handler, add a branch (alongside `set_bags`):

```ts
    } else if (act === 'set_notes') {
      await setApplicationNotes(env.DB, id, String(form.get('admin_notes') ?? '').slice(0, 5000));
      return Astro.redirect(`${detailUrl}?done=notes`, 303);
```

Extend the `banner` line to cover `done=notes` (add `: done === 'notes' ? 'Your notes were saved.'` before the csrf case).

- [ ] **Step 2: Enrich the People table**

Replace the `<thead>` and the `<tbody>` `map` in the "People" section with columns for relationship label + flags + shoe/coat, and the "verify" tag:

```astro
          <thead><tr><th class="border-b p-2">Name</th><th class="border-b p-2">Relationship</th><th class="border-b p-2">Sex</th><th class="border-b p-2">Age</th><th class="border-b p-2">Sizes</th><th class="border-b p-2">Gifts wanted</th></tr></thead>
          <tbody>
            {detail.members.map((m) => (
              <tr>
                <td class="border-b p-2">{m.name}</td>
                <td class="border-b p-2">
                  {relationshipLabel(String(m.relationship ?? ''), String(m.relationship_other ?? ''))}
                  {NON_FAMILY_RELATIONSHIPS.has(String(m.relationship ?? '')) && (
                    <span class="mt-1 block rounded bg-gold-500 px-2 py-1 text-base font-bold text-stone-900">Not immediate family — please verify eligibility</span>
                  )}
                  {m.disabled === 1 && <span class="mt-1 block text-base font-semibold text-berry-800">Disabled</span>}
                  {m.part_time === 1 && <span class="mt-1 block text-base text-stone-600">Lives here part-time</span>}
                </td>
                <td class="border-b p-2">{m.sex}</td>
                <td class="border-b p-2">{m.age}</td>
                <td class="border-b p-2">{[['Pants', m.pants], ['Shirt', m.shirt_top], ['Underwear', m.underwear], ['Socks', m.socks], ['Shoe', m.shoe], ['Coat', m.coat], ['Diapers', m.diapers]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</td>
                <td class="border-b p-2">{m.gifts || '—'}</td>
              </tr>
            ))}
          </tbody>
```

- [ ] **Step 3: Show the parentage note**

Immediately after the "People" `</section>`, add (only renders when present):

```astro
      {a.parentage_note ? (
        <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
          <h2 class="text-2xl font-bold text-holly-800">Which children belong to whom</h2>
          <p class="mt-2 whitespace-pre-wrap">{a.parentage_note}</p>
        </section>
      ) : null}
```

- [ ] **Step 4: Add the private admin-notes editor**

Before the "Delete" section, add:

```astro
      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Notes (only you see this)</h2>
        <p class="text-lg text-stone-600">Private notes for your eligibility decisions — for example, "boyfriend excluded, gave gift card." Families never see this.</p>
        <form method="post" class="mt-2">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <textarea name="admin_notes" rows="3" class="w-full rounded border-2 border-stone-400 p-3 text-lg">{a.admin_notes ?? ''}</textarea>
          <button type="submit" name="act" value="set_notes" class="mt-2 rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save notes</button>
        </form>
      </section>
```

- [ ] **Step 5: Build and test**

Run: `npm run build`
Expected: build succeeds.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/pages/admin/applications/[id].astro"
git commit -m "feat(admin): show relationship/disability/sizes + parentage note + private notes editor"
```

---

## Task 6: Admin members editor, application edit, export columns

**Files:**
- Modify: `src/pages/admin/applications/[id]/members.astro`
- Modify: `src/pages/admin/applications/[id]/edit.astro`
- Modify: `src/pages/admin/applications/export.xlsx.ts`

**Interfaces:**
- Consumes: `RELATIONSHIP_OPTIONS` (relationships lib); `MemberEdit` with new optional fields, `ApplicationFullEdit.parentageNote`, `ExportRow.parentage_note/admin_notes` (all from Task 3).

- [ ] **Step 1: Members editor — read the new fields in POST**

In `src/pages/admin/applications/[id]/members.astro`, add the import:

```ts
import { RELATIONSHIP_OPTIONS } from '../../../../lib/relationships';
```

In the POST handler, replace the `const m: MemberEdit = {...}` construction with:

```ts
  const m: MemberEdit = {
    name, relationship: g('relationship'), relationshipOther: g('relationship_other'), sex: g('sex'), age,
    disabled: g('disabled') === 'on', partTime: g('part_time') === 'on',
    pants: g('pants'), shirtTop: g('shirt_top'), underwear: g('underwear'), socks: g('socks'),
    diapers: g('diapers'), shoe: g('shoe'), coat: g('coat'), gifts: g('gifts'),
  };
```

- [ ] **Step 2: Members editor — render the new controls (both forms)**

In BOTH the per-member edit `<form>` and the "Add a person" `<form>`, replace the free-text Relationship label with a dropdown + other input, and add the disabled/part-time checkboxes and shoe/coat inputs. For the **edit** form (has `m`), use this grid block in place of the current Relationship label and add the extra fields (values come from `m`):

Relationship (replace the `<label ...>Relationship<input ... name="relationship" value={m.relationship} /></label>`):

```astro
              <label class="block font-semibold">Relationship
                <select class={input} name="relationship">
                  <option value="">— Choose one —</option>
                  {RELATIONSHIP_OPTIONS.map((o) => <option value={o.value} selected={m.relationship === o.value}>{o.label}</option>)}
                </select>
              </label>
              <label class="block font-semibold">If "Other," describe<input class={input} type="text" name="relationship_other" value={m.relationship_other ?? ''} /></label>
```

Add shoe/coat next to the other size inputs:

```astro
              <label class="block font-semibold">Shoe size<input class={input} type="text" name="shoe" value={m.shoe ?? ''} /></label>
              <label class="block font-semibold">Coat size<input class={input} type="text" name="coat" value={m.coat ?? ''} /></label>
```

Add the two checkboxes just before the Save/Remove button row (inside the form, after the grid `</div>`):

```astro
            <div class="flex flex-wrap gap-6">
              <label class="flex items-center gap-2"><input type="checkbox" name="disabled" checked={m.disabled === 1} class="h-6 w-6" /> Permanently disabled</label>
              <label class="flex items-center gap-2"><input type="checkbox" name="part_time" checked={m.part_time === 1} class="h-6 w-6" /> Lives here part-time</label>
            </div>
```

For the **Add a person** form (no `m`), use the same markup but with empty defaults: the relationship `<select>` options use `selected={false}` (omit `selected`), `relationship_other`/`shoe`/`coat` inputs have no `value`, and the checkboxes are unchecked (omit `checked`).

- [ ] **Step 3: Application edit — add the parentage note field**

`edit.astro` already has a `g` field-getter, builds an `edit: ApplicationFullEdit`, exposes the loaded row as `a`, and has a good-deed textarea. In the `edit` object, add `parentageNote` on the same line as `goodDeed` (the line `goodDeed: g('good_deed'), mayNotBeEligible: on('may_not_be_eligible'),`):

```ts
    goodDeed: g('good_deed'), parentageNote: g('parentage_note'), mayNotBeEligible: on('may_not_be_eligible'),
```

Then, immediately after the "Good deed" `<label>...good_deed...</label>` line, add:

```astro
      <h2 class="text-2xl font-bold text-holly-800">Which children belong to whom</h2>
      <label class="block font-semibold">Blended families — which children are a partner's or other adult's<textarea class={input} name="parentage_note" rows="3">{a.parentage_note ?? ''}</textarea></label>
```

- [ ] **Step 4: Export — add the two columns**

In `src/pages/admin/applications/export.xlsx.ts`, append two headers to the `headers` array (after `'Jobs'`):

```ts
    'Jobs', 'Parentage note', 'Your notes',
```

and append the two values to each mapped `data` row (after `r.employment_summary`):

```ts
    r.employment_summary, r.parentage_note, r.admin_notes,
```

- [ ] **Step 5: Build and test**

Run: `npm run build`
Expected: build succeeds.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/pages/admin/applications/[id]/members.astro" "src/pages/admin/applications/[id]/edit.astro" src/pages/admin/applications/export.xlsx.ts
git commit -m "feat(admin): edit relationship/disability/sizes + parentage note; export new columns"
```

---

## After all tasks: deployment note (operator/developer, not code)

- Apply the migration to the live database once: `npm run db:migrate:remote` (runs `wrangler d1 migrations apply gchp --remote`), then redeploy (`npx wrangler pages deploy dist --project-name gchp-site`).
- The downloadable paper application (`/application.pdf`) still needs the current `PROJECT APPLICATION.docx` converted to PDF and uploaded to R2 — pending the operator confirming which page-2 revision is current. This is out of scope for this plan (operational task).

## Self-review notes (checked against the spec)

- **Spec coverage:** relationship dropdown (T1 lib, T2 validation, T4 form, T5/T6 admin); per-person disabled (T2/T3/T4/T5/T6, derived app flag in T2); blended-family note (T2/T3/T4/T5/T6); shoe+coat (all layers); part-time marker (T2/T3/T4/T5); private admin notes (T3/T5); admin+Excel surfacing (T5/T6 + T3 query); one-project notice (T4); no items list + no-expensive-items note (T4); paper-mailing fix (T4); migration + harness (T1); no separate marital field (not built). All covered.
- **Type consistency:** field names (`member_relationship_other_{i}`, `member_disabled_{i}`, `member_part_time_{i}`, `member_shoe_{i}`, `member_coat_{i}`, `parentage_note`) are identical across form (T4), validation (T2), and admin (T6). Canonical relationship values identical across lib/validation/db CASE/admin.
- **Migration discipline:** `0001_init.sql` stays immutable; new columns live only in `0003`; the harness applies `0001` then `0003`, matching what `wrangler d1 migrations apply` does to production.
