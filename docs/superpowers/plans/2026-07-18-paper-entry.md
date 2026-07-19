# Paper-Application Entry (Admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only `/admin/applications/new` page where the operator types a paper application in — lenient validation (name + town only), no email/rate-limit/open-toggle, date-received + household-type + optional PU# + private notes on the form, `source='paper'` on the record.

**Architecture:** Migration `0007` adds `applications.source` (default `''` = pre-tracking); `insertApplication` gains an optional `source` param (public path stamps `'online'` without touching `apply.astro`); a new lenient `validateApplicationAdmin` in its own file reuses the strict layer's parsers; the admin page reuses the Apply leaf components (`MemberCard`, `EmployerRow`, `BenefitRow`, `FieldError`) and Apply's add-row re-render pattern.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Cloudflare D1, Vitest. Tests `npm test`; build `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-18-paper-entry-design.md`.

## Global Constraints

- **`src/pages/apply.astro` and the strict validators in `src/lib/validation/application.ts` are NOT modified** (adding exports to the validation file is allowed; changing existing functions is not).
- Lenient rules: required = `first_name`, `last_name`, valid `city_id`. Everything else blank-allowed. Malformed values (bad number, bad email, over-cap text) still get kind field errors; **blank is never an error**. Errors re-render with all values preserved.
- "Unknown on paper" conventions (shown as form hints): blank wage/hours → 0; blank age → 0; blank sex → stored `''`; blank relationship → `''`; blank bedding choice → `'none'`; sheets/blanket without size → size null. Zero members is allowed. A member/employer row with ANY content requires a name (traceability) — that is a kind error, not a blank-is-error.
- No email is sent on entry. No rate limit. Works while applications are closed.
- `submitted_at` = the received date as `YYYY-MM-DDT12:00:00Z` (noon UTC = same Central calendar day year-round); `season_year` = the received date's year.
- Save is never lost: a duplicate PU# still saves the application and lands on the detail page with the standard `error=pu_taken&by=N` banner.
- Legacy honesty: migration default `''`; only new inserts stamp `'online'`/`'paper'`.
- Admin: ≥18px, plain English, text buttons, CSRF on the POST, no-store via middleware, no inline scripts, straight apostrophes. Copy must not confuse this page with the "Paper application" PDF-upload screen.

---

## Task 1: Migration 0007 + source plumbing

**Files:**
- Create: `migrations/0007_source.sql`
- Modify: `tests/helpers/d1.ts:11` (migration loop)
- Modify: `src/lib/db.ts` — `NewApplication` (~:60), `insertApplication` INSERT (~:72-98), `ExportRow` + export SELECT (`a.source`)
- Create: `tests/db-source.test.ts`
- Modify: `tests/d1-schema.test.ts` (one case)

**Interfaces:**
- Produces: `applications.source TEXT NOT NULL DEFAULT ''`; `NewApplication` gains `source?: 'online' | 'paper'` (insert stamps `app.source ?? 'online'`); `ExportRow` gains `source: string`.

- [ ] **Step 1: Migration + harness**

Create `migrations/0007_source.sql`:

```sql
-- Where an application came from (2026-07-18 paper-entry spec). Default '' on
-- purpose: rows created before source tracking stay honestly unlabeled.
-- New inserts stamp 'online' (public form) or 'paper' (admin entry).
ALTER TABLE applications ADD COLUMN source TEXT NOT NULL DEFAULT '';
```

Append `'migrations/0007_source.sql'` to the loop in `tests/helpers/d1.ts:11`.

- [ ] **Step 2: Failing tests**

Create `tests/db-source.test.ts` (reuse the `base: NewApplication` fixture shape from `tests/db-decided-at.test.ts` verbatim):

```ts
import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, listApplicationsForExport, type NewApplication } from '../src/lib/db';

const base: NewApplication = { /* copy the fixture from tests/db-decided-at.test.ts */ };

describe('application source', () => {
  it("defaults to 'online' and honors an explicit 'paper'", async () => {
    const { db, dispose } = await getTestDb();
    try {
      const online = await insertApplication(db, base);
      const paper = await insertApplication(db, { ...base, lastName: 'Paper', source: 'paper' });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      expect(rows.find((r) => r.last_name === 'Smith')?.source).toBe('online');
      expect(rows.find((r) => r.last_name === 'Paper')?.source).toBe('paper');
      expect(online).toBeGreaterThan(0); expect(paper).toBeGreaterThan(0);
    } finally { await dispose(); }
  });
});
```

In `tests/d1-schema.test.ts` add (matching the file's style):

```ts
it('0007 adds applications.source with empty default', async () => {
  const cols = await db.prepare("SELECT name FROM pragma_table_info('applications')").all<{ name: string }>();
  expect(cols.results.map((c) => c.name)).toContain('source');
});
```

Run: `npx vitest run tests/db-source.test.ts` — expected FAIL (`source` not a NewApplication field / not selected).

- [ ] **Step 3: Implement**

In `src/lib/db.ts`:
- `NewApplication` (the intersection type at ~:60) gains `source?: 'online' | 'paper';`
- `insertApplication`'s applications INSERT: add the `source` column and bind `app.source ?? 'online'` (extend the column list and VALUES placeholders — count them after editing).
- `ExportRow` gains `source: string;` and the export SELECT gains `a.source,` (beside `a.decided_at`).

- [ ] **Step 4: Green + full suite**

Run: `npx vitest run tests/db-source.test.ts tests/d1-schema.test.ts`, then `npm test`, `npx tsc --noEmit`
Expected: all pass, tsc exit 0 (existing insert callers compile — the field is optional).

- [ ] **Step 5: Commit**

```bash
git add migrations/0007_source.sql tests/helpers/d1.ts src/lib/db.ts tests/db-source.test.ts tests/d1-schema.test.ts
git commit -m "feat(db): application source column — online/paper stamped, legacy rows stay blank"
```

---

## Task 2: Lenient validation — validateApplicationAdmin (TDD)

**Files:**
- Create: `src/lib/validation/application-admin.ts`
- Create: `tests/application-admin-validation.test.ts`

**Interfaces:**
- Consumes (all already exported from `src/lib/validation/application.ts`): `parseMoney`, `parseIntInRange`, `validateBenefits` is NOT reused (its blank-amount rule is strict) — only the two parsers, `validateParentageNote`, `MAX_MEMBERS`, `MAX_EMPLOYERS`, and the types `ApplicationInput`, `Errors`, `CleanApplication`, `MemberClean`, `EmployerClean`, `BenefitsClean`, `AboutClean`, `BeddingClean`. Also `RELATIONSHIP_VALUES` from `src/lib/relationships.ts`.
- Produces: `validateApplicationAdmin(input: ApplicationInput): { ok: true; clean: CleanApplication } | { ok: false; errors: Errors }` — same `CleanApplication` shape as the strict path, so `insertApplication` and the eligibility helpers work unchanged.

- [ ] **Step 1: Write the failing tests**

Create `tests/application-admin-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateApplicationAdmin } from '../src/lib/validation/application-admin';
import { validateApplication } from '../src/lib/validation/application';

const minimal = { first_name: 'Sue', last_name: 'Smith', city_id: '13' };

describe('validateApplicationAdmin — lenient', () => {
  it('accepts name + town alone, with safe defaults everywhere else', () => {
    const r = validateApplicationAdmin(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.firstName).toBe('Sue');
      expect(r.clean.cityId).toBe(13);
      expect(r.clean.address).toBe('');
      expect(r.clean.phone).toBe('');
      expect(r.clean.email).toBe('');
      expect(r.clean.goodDeed).toBe('');
      expect(r.clean.members).toEqual([]);
      expect(r.clean.employers).toEqual([]);
      expect(r.clean.bedChoice).toBe('none');
      expect(r.clean.yearsReceivedHelp).toBe(0);
      expect(r.clean.adoptedLastYear).toBe(false);
      expect(r.clean.noEmploymentConfirmed).toBe(false);
      expect(r.clean.benefits.foodShareAmount).toBeNull();
    }
  });
  it('requires first name, last name, and a valid town', () => {
    const r1 = validateApplicationAdmin({ last_name: 'S', city_id: '13' });
    const r2 = validateApplicationAdmin({ first_name: 'S', last_name: 'S', city_id: '' });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.first_name).toBeTruthy();
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.city_id).toBeTruthy();
  });
  it('blank is never an error, but malformed still is', () => {
    const bad = validateApplicationAdmin({ ...minimal, email: 'not-an-email', ssi_amount: 'abc', years_received_help: 'x' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.email).toBeTruthy();
      expect(bad.errors.ssi_amount).toBeTruthy();
      expect(bad.errors.years_received_help).toBeTruthy();
    }
    const blank = validateApplicationAdmin({ ...minimal, email: '', ssi_amount: '', years_received_help: '' });
    expect(blank.ok).toBe(true);
  });
  it('benefit amounts parse without the _none checkbox; forWhom optional', () => {
    const r = validateApplicationAdmin({ ...minimal, ssi_amount: '520', child_support_amount: '$200' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.benefits.ssiAmount).toBe(520);
      expect(r.clean.benefits.childSupportAmount).toBe(200);
      expect(r.clean.benefits.ssiFor).toBe('');
    }
  });
  it('member rows: all-blank skipped (even row 1); content requires a name; unknowns default', () => {
    const skipped = validateApplicationAdmin({ ...minimal, member_count: '2', member_relationship_1: 'self' });
    expect(skipped.ok).toBe(true); // relationship-only row 1 comes from the form prefill — still "blank"
    if (skipped.ok) expect(skipped.clean.members).toEqual([]);
    const named = validateApplicationAdmin({ ...minimal, member_name_1: 'Sue Smith', member_relationship_1: 'self' });
    expect(named.ok).toBe(true);
    if (named.ok) {
      expect(named.clean.members).toHaveLength(1);
      expect(named.clean.members[0].age).toBe(0);
      expect(named.clean.members[0].sex).toBe('');
    }
    const nameless = validateApplicationAdmin({ ...minimal, member_age_1: '7' });
    expect(nameless.ok).toBe(false);
    if (!nameless.ok) expect(nameless.errors.member_name_1).toBeTruthy();
  });
  it('employer rows: blank wage/hours default to 0; content requires the employer name', () => {
    const r = validateApplicationAdmin({ ...minimal, employer_name_1: 'Kwik Trip' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.employers[0]).toEqual({ employerName: 'Kwik Trip', workerName: '', hourlyWage: 0, hoursPerWeek: 0 });
    }
    const nameless = validateApplicationAdmin({ ...minimal, hourly_wage_1: '15' });
    expect(nameless.ok).toBe(false);
    if (!nameless.ok) expect(nameless.errors.employer_name_1).toBeTruthy();
  });
  it('bedding: blank means none; a choice without a size keeps the choice', () => {
    const r = validateApplicationAdmin({ ...minimal, bed_choice: 'blanket' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.clean.bedChoice).toBe('blanket'); expect(r.clean.bedSize).toBeNull(); }
  });
  it('a fully-filled strict submission parses to the same clean output as the strict path', () => {
    const full: Record<string, string> = {
      first_name: 'Sue', last_name: 'Smith', address: '1 Elm', city_id: '13', phone: '608',
      email: 'a@b.co', email_confirm: 'a@b.co', full_time_residence: 'on', years_received_help: '2',
      adopted_last_year: 'no', bed_choice: 'sheets', bed_size: 'full', good_deed: 'Shoveled snow.',
      member_count: '1', member_name_1: 'Sue Smith', member_relationship_1: 'self', member_sex_1: 'F', member_age_1: '40',
      employer_count: '1', employer_name_1: 'Acme', worker_name_1: 'Sue', hourly_wage_1: '15', hours_per_week_1: '40',
      food_share_none: 'on', social_security_none: 'on', ssi_none: 'on', child_support_none: 'on',
      unemployment_none: 'on', other_income_none: 'on',
    };
    const strict = validateApplication(full);
    const admin = validateApplicationAdmin(full);
    expect(strict.ok && !('spam' in strict && strict.spam === true && false)).toBe(true);
    expect(admin.ok).toBe(true);
    if (strict.ok && !strict.spam && admin.ok) expect(admin.clean).toEqual(strict.clean);
  });
  it('derives permanentlyDisabled from members like the strict path', () => {
    const r = validateApplicationAdmin({ ...minimal, member_name_1: 'Sue', member_disabled_1: 'on' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clean.permanentlyDisabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/application-admin-validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/validation/application-admin.ts`:

```ts
// Lenient validation for the ADMIN paper-entry form (2026-07-18 spec).
// The operator transcribes what is on the paper — including incomplete
// applications she needs on record (e.g. to deny). Rules: only first name,
// last name, and town are required; blank is NEVER an error; malformed values
// still get kind errors. "Unknown on paper" conventions: wage/hours/age blank
// -> 0, sex/relationship blank -> '', bedding blank -> 'none'.
// The strict public-form path (validateApplication) is untouched.
import {
  parseMoney, parseIntInRange, validateParentageNote, MAX_MEMBERS, MAX_EMPLOYERS,
  type ApplicationInput, type Errors, type CleanApplication, type MemberClean,
  type EmployerClean, type BenefitsClean,
} from './application';
import { RELATIONSHIP_VALUES } from '../relationships';

const get = (input: ApplicationInput, key: string): string => (input[key] ?? '').trim();
const isOn = (input: ApplicationInput, key: string): boolean => (input[key] ?? '') === 'on';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowCount(input: ApplicationInput, key: string, max: number): number {
  const n = Number((input[key] ?? '1').trim());
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, max);
}

const BENEFIT_KEYS = [
  { key: 'food_share', hasFor: false },
  { key: 'social_security', hasFor: true },
  { key: 'ssi', hasFor: true },
  { key: 'child_support', hasFor: true },
  { key: 'unemployment', hasFor: true },
  { key: 'other_income', hasFor: true },
] as const;

export function validateApplicationAdmin(
  input: ApplicationInput,
): { ok: true; clean: CleanApplication } | { ok: false; errors: Errors } {
  const errors: Errors = {};

  // About — only name + town required.
  const firstName = get(input, 'first_name');
  const lastName = get(input, 'last_name');
  if (firstName === '') errors.first_name = "Please enter the applicant's first name.";
  if (lastName === '') errors.last_name = "Please enter the applicant's last name.";
  const cityId = parseIntInRange(get(input, 'city_id'), 1, 9999);
  if (cityId === null) errors.city_id = 'Please pick the town from the list.';
  const email = get(input, 'email');
  if (email !== '' && !EMAIL_RE.test(email)) {
    errors.email = "That email address doesn't look quite right — please check it.";
  }
  const yearsRaw = get(input, 'years_received_help');
  const years = yearsRaw === '' ? 0 : parseIntInRange(yearsRaw, 0, 99);
  if (years === null) errors.years_received_help = 'Please enter the years as a number, or leave it blank.';

  // Bedding — blank means none; a choice without a size keeps the choice.
  const bedRaw = get(input, 'bed_choice');
  const bedChoice = bedRaw === 'sheets' || bedRaw === 'blanket' ? bedRaw : 'none';
  const sizeRaw = get(input, 'bed_size');
  const bedSize =
    bedChoice !== 'none' && (sizeRaw === 'twin' || sizeRaw === 'full' || sizeRaw === 'queen' || sizeRaw === 'king')
      ? sizeRaw
      : null;

  // Employers — blank rows skipped; content needs the employer's name;
  // blank wage/hours mean "not on the paper" and record as 0.
  const employers: EmployerClean[] = [];
  const employerCount = rowCount(input, 'employer_count', MAX_EMPLOYERS);
  for (let i = 1; i <= employerCount; i++) {
    const name = get(input, `employer_name_${i}`);
    const worker = get(input, `worker_name_${i}`);
    const wageRaw = get(input, `hourly_wage_${i}`);
    const hoursRaw = get(input, `hours_per_week_${i}`);
    if (name === '' && worker === '' && wageRaw === '' && hoursRaw === '') continue;
    if (name === '') {
      errors[`employer_name_${i}`] = "Please enter the employer's name for this row.";
      continue;
    }
    const wage = wageRaw === '' ? 0 : parseMoney(wageRaw);
    if (wage === null) errors[`hourly_wage_${i}`] = 'Please enter the wage as a number, or leave it blank.';
    const hours = hoursRaw === '' ? 0 : parseMoney(hoursRaw);
    if (hours === null || (hours ?? 0) > 168) {
      errors[`hours_per_week_${i}`] = 'Please enter hours per week as a number, or leave it blank.';
    }
    if (errors[`hourly_wage_${i}`] || errors[`hours_per_week_${i}`]) continue;
    employers.push({ employerName: name, workerName: worker, hourlyWage: wage as number, hoursPerWeek: hours as number });
  }

  // Benefits — blank amount is simply null; no _none checkbox needed; forWhom optional.
  const b: Record<string, number | null | string> = {};
  for (const { key } of BENEFIT_KEYS) {
    const amountRaw = get(input, `${key}_amount`);
    const none = isOn(input, `${key}_none`);
    let amount: number | null = null;
    if (!none && amountRaw !== '') {
      amount = parseMoney(amountRaw);
      if (amount === null) errors[`${key}_amount`] = 'Please enter the amount as a number, or leave it blank.';
    }
    b[`${key}_amount`] = amount;
    b[`${key}_for`] = none ? '' : get(input, `${key}_for`);
  }
  const benefits: BenefitsClean = {
    foodShareAmount: b.food_share_amount as number | null,
    socialSecurityAmount: b.social_security_amount as number | null,
    socialSecurityFor: b.social_security_for as string,
    ssiAmount: b.ssi_amount as number | null,
    ssiFor: b.ssi_for as string,
    childSupportAmount: b.child_support_amount as number | null,
    childSupportFor: b.child_support_for as string,
    unemploymentWeeklyAmount: b.unemployment_amount as number | null,
    unemploymentFor: b.unemployment_for as string,
    otherIncomeAmount: b.other_income_amount as number | null,
    otherIncomeFor: b.other_income_for as string,
  };

  // Members — all-blank rows skipped even for row 1 (zero members = incomplete
  // paper, allowed); a row with content needs a name; unknowns default.
  // NOTE the deliberate type loosening: paper may not say M/F, so sex may be
  // '' — D1 stores it fine and the admin UI renders '' as a dash. The cast is
  // confined to this one site.
  const members: MemberClean[] = [];
  const memberCount = rowCount(input, 'member_count', MAX_MEMBERS);
  for (let i = 1; i <= memberCount; i++) {
    const name = get(input, `member_name_${i}`);
    const relationship = get(input, `member_relationship_${i}`);
    const relationshipOther = get(input, `member_relationship_other_${i}`);
    const sexRaw = get(input, `member_sex_${i}`);
    const ageRaw = get(input, `member_age_${i}`);
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
    const contentBlank =
      name === '' && sexRaw === '' && ageRaw === '' && relationshipOther === '' &&
      Object.values(sizes).every((s) => s === '') && gifts === '' &&
      !isOn(input, `member_disabled_${i}`) && !isOn(input, `member_part_time_${i}`);
    if (contentBlank) continue; // relationship-only rows are form prefill, not content
    if (name === '') {
      errors[`member_name_${i}`] = "Please give this person's name, or clear the row.";
      continue;
    }
    const age = ageRaw === '' ? 0 : parseIntInRange(ageRaw, 0, 110);
    if (age === null) {
      errors[`member_age_${i}`] = 'Please enter the age as a number, or leave it blank.';
      continue;
    }
    members.push({
      name,
      relationship: RELATIONSHIP_VALUES.has(relationship) ? relationship : '',
      relationshipOther,
      sex: (sexRaw === 'M' || sexRaw === 'F' ? sexRaw : '') as 'M' | 'F',
      age,
      disabled: isOn(input, `member_disabled_${i}`),
      partTime: isOn(input, `member_part_time_${i}`),
      ...sizes,
      gifts,
    });
  }

  const goodDeedRaw = get(input, 'good_deed');
  if (goodDeedRaw.length > 5000) errors.good_deed = "That's a little long — please shorten it to the highlights.";
  const parentageNote = validateParentageNote(input, errors);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    clean: {
      firstName, lastName,
      address: get(input, 'address'),
      cityId: cityId as number,
      phone: get(input, 'phone'),
      email,
      diabetic: isOn(input, 'diabetic'),
      shareWithSponsor: isOn(input, 'share_with_sponsor'),
      fullTimeResidenceConfirmed: isOn(input, 'full_time_residence'),
      yearsReceivedHelp: years as number,
      adoptedLastYear: get(input, 'adopted_last_year') === 'yes',
      bedChoice, bedSize,
      noEmploymentConfirmed: isOn(input, 'no_employment'),
      employers, benefits, members,
      goodDeed: goodDeedRaw,
      permanentlyDisabled: members.some((m) => m.disabled === true),
      parentageNote: parentageNote ?? '',
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/application-admin-validation.test.ts`
Expected: PASS (9 tests). If the strict-equality test (`admin.clean` vs `strict.clean`) fails on field order/undefined-vs-missing, align the admin output's optional fields to the strict path's shape (e.g. `relationshipOther` always a string) — fix the ADMIN file, never the strict one.

- [ ] **Step 5: Full suite + commit**

Run: `npm test`, `npx tsc --noEmit` — all green. Then:

```bash
git add src/lib/validation/application-admin.ts tests/application-admin-validation.test.ts
git commit -m "feat(validation): lenient validateApplicationAdmin for paper entry — name+town required, blank never errs"
```

---

## Task 3: The entry page + surfaces

**Files:**
- Create: `src/pages/admin/applications/new.astro`
- Modify: `src/pages/admin/applications/index.astro` (one button)
- Modify: `src/pages/admin/applications/[id].astro` (one "Entered from paper" line)
- Modify: `src/pages/admin/applications/export.xlsx.ts` (Source column)

**Interfaces:**
- Consumes: `validateApplicationAdmin` (Task 2); `insertApplication` with `source: 'paper'` (Task 1); `setApplicationNotes`, `setPuNumber`, `listCities` (existing db.ts); CSRF helpers; components `MemberCard`, `EmployerRow`, `BenefitRow`, `FieldError` from `src/components/apply/`; `ExportRow.source` (Task 1).

- [ ] **Step 1: The page**

Create `src/pages/admin/applications/new.astro`:

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import { insertApplication, setApplicationNotes, setPuNumber, listCities } from '../../../lib/db';
import { validateApplicationAdmin } from '../../../lib/validation/application-admin';
import { MAX_MEMBERS, MAX_EMPLOYERS } from '../../../lib/validation/application';
import { mayNotBeEligible } from '../../../lib/eligibility';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
import MemberCard from '../../../components/apply/MemberCard.astro';
import EmployerRow from '../../../components/apply/EmployerRow.astro';
import BenefitRow from '../../../components/apply/BenefitRow.astro';
import FieldError from '../../../components/apply/FieldError.astro';
export const prerender = false;

const env = Astro.locals.runtime.env;

// Today in Central as YYYY-MM-DD (en-CA gives ISO date order).
const todayCentral = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

let values: Record<string, string> = { member_relationship_1: 'self', received_date: todayCentral };
let errors: Record<string, string> = {};

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  values = Object.fromEntries(
    [...form.entries()].filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
  const action = values.action ?? '';
  if (action === 'add_member' || action === 'add_employer') {
    // Grow the form, JS-free — same pattern as the public Apply page.
    const key = action === 'add_member' ? 'member_count' : 'employer_count';
    const max = action === 'add_member' ? MAX_MEMBERS : MAX_EMPLOYERS;
    values[key] = String(Math.min((Number(values[key]) || 1) + 1, max));
  } else {
    const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', values.csrf_token ?? '');
    if (!okCsrf) {
      errors.csrf = "That didn't save — please press Save again.";
    } else {
      const result = validateApplicationAdmin(values);
      // Received date: default today; reject garbage kindly.
      const dateRaw = (values.received_date ?? '').trim() || todayCentral;
      const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw);
      if (!dateOk) errors.received_date = 'Please pick the date this application arrived.';
      const puRaw = (values.pu_number ?? '').trim();
      if (puRaw !== '' && !/^\d+$/.test(puRaw)) {
        errors.pu_number = 'Please enter the pickup number as a whole number, like 803.';
      }
      const ht = values.household_type;
      const householdType = ht === 'elderly' || ht === 'disabled' ? ht : 'family';
      if (result.ok && dateOk && !errors.pu_number) {
        const seasonYear = Number(dateRaw.slice(0, 4));
        const id = await insertApplication(env.DB, {
          ...result.clean,
          seasonYear,
          // Noon UTC is the same Central calendar day year-round.
          submittedAt: `${dateRaw}T12:00:00Z`,
          mayNotBeEligible: mayNotBeEligible(result.clean),
          householdType,
          source: 'paper',
        });
        const notes = (values.admin_notes ?? '').trim().slice(0, 5000);
        if (notes !== '') await setApplicationNotes(env.DB, id, notes);
        if (puRaw !== '') {
          const r = await setPuNumber(env.DB, id, seasonYear, Number(puRaw));
          // On a clash, carry ONLY the error flag: the detail page's banner
          // chain shows the first matching case, and the duplicate-number
          // warning must not be suppressed by a "created" banner. The saved
          // application is self-evident — she lands on its page.
          if (!r.ok) return Astro.redirect(`/admin/applications/${id}?error=pu_taken&by=${r.takenBy}`, 303);
        }
        return Astro.redirect(`/admin/applications/${id}?done=created`, 303);
      }
      if (!result.ok) errors = { ...result.errors, ...errors };
    }
  }
}

const memberCount = Math.min(Math.max(Number(values.member_count) || 1, 1), MAX_MEMBERS);
const employerCount = Math.min(Math.max(Number(values.employer_count) || 1, 1), MAX_EMPLOYERS);
const cities = await listCities(env.DB);

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
const v = (n: string) => values[n] ?? '';
---
<Admin title="Enter a paper application" heading="Enter a paper application"
  back={{ href: '/admin/applications', label: 'Back to applications' }}>
  <p class="mt-1 text-lg text-stone-600">
    Help: type in a mailed or handed-in application. Leave anything blank that is blank on the paper —
    only the name and town are required. Nothing is emailed to the family.
  </p>

  {errors.csrf && <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4" role="alert"><p class="font-bold text-berry-800">{errors.csrf}</p></div>}
  {Object.keys(errors).length > 0 && !errors.csrf && (
    <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4" role="alert">
      <p class="font-bold text-berry-800">A few things need a look — they are marked below. Nothing you typed is lost.</p>
    </div>
  )}

  <form method="post" class="mt-6 space-y-8">
    <input type="hidden" name="csrf_token" value={csrfToken} />

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">About this paper application</h2>
      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="block font-semibold">Date received
          <input class={input} type="date" name="received_date" value={v('received_date')}
            aria-invalid={errors.received_date ? 'true' : undefined} aria-describedby={errors.received_date ? 'received_date-error' : undefined} />
          <FieldError id="received_date" errors={errors} />
        </label>
        <label class="block font-semibold">Pickup number, if written on the paper
          <input class={input} type="text" inputmode="numeric" name="pu_number" value={v('pu_number')}
            aria-invalid={errors.pu_number ? 'true' : undefined} aria-describedby={errors.pu_number ? 'pu_number-error' : undefined} />
          <FieldError id="pu_number" errors={errors} />
        </label>
      </div>
      <fieldset class="mt-4">
        <legend class="font-semibold">Type of household</legend>
        <div class="mt-1 flex flex-wrap gap-4 text-lg">
          <label class="flex items-center gap-2"><input type="radio" name="household_type" value="family" checked={v('household_type') !== 'elderly' && v('household_type') !== 'disabled'} class="h-6 w-6" /> Family</label>
          <label class="flex items-center gap-2"><input type="radio" name="household_type" value="elderly" checked={v('household_type') === 'elderly'} class="h-6 w-6" /> Elderly</label>
          <label class="flex items-center gap-2"><input type="radio" name="household_type" value="disabled" checked={v('household_type') === 'disabled'} class="h-6 w-6" /> Disabled</label>
        </div>
      </fieldset>
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">The applicant</h2>
      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="block font-semibold">First name
          <input class={input} type="text" name="first_name" value={v('first_name')}
            aria-invalid={errors.first_name ? 'true' : undefined} aria-describedby={errors.first_name ? 'first_name-error' : undefined} />
          <FieldError id="first_name" errors={errors} />
        </label>
        <label class="block font-semibold">Last name
          <input class={input} type="text" name="last_name" value={v('last_name')}
            aria-invalid={errors.last_name ? 'true' : undefined} aria-describedby={errors.last_name ? 'last_name-error' : undefined} />
          <FieldError id="last_name" errors={errors} />
        </label>
        <label class="block font-semibold">Street address
          <input class={input} type="text" name="address" value={v('address')} />
        </label>
        <label class="block font-semibold">Town
          <select class={input} name="city_id" aria-invalid={errors.city_id ? 'true' : undefined} aria-describedby={errors.city_id ? 'city_id-error' : undefined}>
            <option value="">Pick the town</option>
            {cities.map((c) => <option value={String(c.id)} selected={v('city_id') === String(c.id)}>{c.name}</option>)}
          </select>
          <FieldError id="city_id" errors={errors} />
        </label>
        <label class="block font-semibold">Phone
          <input class={input} type="text" name="phone" value={v('phone')} />
        </label>
        <label class="block font-semibold">Email
          <input class={input} type="text" name="email" value={v('email')}
            aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? 'email-error' : undefined} />
          <FieldError id="email" errors={errors} />
        </label>
        <label class="block font-semibold">Years received help
          <input class={input} type="text" inputmode="numeric" name="years_received_help" value={v('years_received_help')}
            aria-invalid={errors.years_received_help ? 'true' : undefined} aria-describedby={errors.years_received_help ? 'years_received_help-error' : undefined} />
          <FieldError id="years_received_help" errors={errors} />
        </label>
      </div>
      <div class="mt-4 flex flex-wrap gap-6 text-lg">
        <label class="flex items-center gap-2"><input type="checkbox" name="share_with_sponsor" checked={v('share_with_sponsor') === 'on'} class="h-6 w-6" /> OK to adopt out (circled Yes)</label>
        <label class="flex items-center gap-2"><input type="radio" name="adopted_last_year" value="yes" checked={v('adopted_last_year') === 'yes'} class="h-6 w-6" /> Adopted last year: yes</label>
        <label class="flex items-center gap-2"><input type="radio" name="adopted_last_year" value="no" checked={v('adopted_last_year') === 'no'} class="h-6 w-6" /> no</label>
        <label class="flex items-center gap-2"><input type="checkbox" name="full_time_residence" checked={v('full_time_residence') === 'on'} class="h-6 w-6" /> Residence rule met</label>
        <label class="flex items-center gap-2"><input type="checkbox" name="diabetic" checked={v('diabetic') === 'on'} class="h-6 w-6" /> Diabetic in household</label>
      </div>
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">People in the household</h2>
      <p class="mt-1 text-lg text-stone-600">Skip rows that are blank on the paper. Enter 0 for an age that is not given.</p>
      <input type="hidden" name="member_count" value={String(memberCount)} />
      {Array.from({ length: memberCount }, (_, idx) => <MemberCard index={idx + 1} values={values} errors={errors} />)}
      <button type="submit" name="action" value="add_member" formnovalidate
        class="mt-3 rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">
        + Add another person
      </button>
      <label class="mt-4 block font-semibold">Which children belong to whom (if noted)
        <textarea class={input} name="parentage_note" rows="2" maxlength={2000}>{v('parentage_note')}</textarea>
        <FieldError id="parentage_note" errors={errors} />
      </label>
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">Bedding</h2>
      <div class="mt-2 flex flex-wrap gap-4 text-lg">
        <label class="flex items-center gap-2"><input type="radio" name="bed_choice" value="sheets" checked={v('bed_choice') === 'sheets'} class="h-6 w-6" /> Sheets</label>
        <label class="flex items-center gap-2"><input type="radio" name="bed_choice" value="blanket" checked={v('bed_choice') === 'blanket'} class="h-6 w-6" /> Blanket</label>
        <label class="flex items-center gap-2"><input type="radio" name="bed_choice" value="none" checked={v('bed_choice') === 'none' || v('bed_choice') === ''} class="h-6 w-6" /> Nothing marked</label>
      </div>
      <div class="mt-2 flex flex-wrap gap-4 text-lg">
        {['twin', 'full', 'queen', 'king'].map((s) => (
          <label class="flex items-center gap-2"><input type="radio" name="bed_size" value={s} checked={v('bed_size') === s} class="h-6 w-6" /> {s}</label>
        ))}
      </div>
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">Work and income</h2>
      <p class="mt-1 text-lg text-stone-600">Enter 0 for a wage or hours the paper leaves blank.</p>
      <input type="hidden" name="employer_count" value={String(employerCount)} />
      {Array.from({ length: employerCount }, (_, idx) => <EmployerRow index={idx + 1} values={values} errors={errors} />)}
      <button type="submit" name="action" value="add_employer" formnovalidate
        class="mt-3 rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">
        + Add another job
      </button>
      <label class="mt-3 flex items-center gap-2 text-lg">
        <input type="checkbox" name="no_employment" checked={v('no_employment') === 'on'} class="h-6 w-6" /> Paper says no one is employed
      </label>
      <BenefitRow benefitKey="food_share" label="Food Share" period="Monthly" hasFor={false} values={values} errors={errors} />
      <BenefitRow benefitKey="social_security" label="Social Security" period="Monthly" hasFor={true} values={values} errors={errors} />
      <BenefitRow benefitKey="ssi" label="SSI" period="Monthly" hasFor={true} values={values} errors={errors} />
      <BenefitRow benefitKey="child_support" label="Child support" period="Monthly" hasFor={true} values={values} errors={errors} />
      <BenefitRow benefitKey="unemployment" label="Unemployment" period="Weekly" hasFor={true} values={values} errors={errors} />
      <BenefitRow benefitKey="other_income" label="Other income" period="Monthly" hasFor={true} values={values} errors={errors} />
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">Pay it forward</h2>
      <label class="mt-2 block font-semibold">Good deeds from page 3 (blank if not filled in)
        <textarea class={input} name="good_deed" rows="3" maxlength={5000}>{v('good_deed')}</textarea>
        <FieldError id="good_deed" errors={errors} />
      </label>
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">Notes (only you see this)</h2>
      <p class="text-lg text-stone-600">Anything else on the paper with no field here — has a car, doll preference, Box number.</p>
      <textarea class={input} name="admin_notes" rows="3" maxlength={5000}>{v('admin_notes')}</textarea>
    </section>

    <button type="submit" class="rounded-lg bg-holly-700 px-6 py-4 text-xl font-bold text-white hover:bg-holly-900">
      Save this application
    </button>
  </form>
</Admin>
```

- [ ] **Step 2: List button, detail line, export column**

`src/pages/admin/applications/index.astro` — next to the existing export/download control, add:

```astro
      <a href="/admin/applications/new" class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">Enter a paper application</a>
```

`src/pages/admin/applications/[id].astro` — in the Household section, directly under the "Applied:" line (added by the decision-times feature), add:

```astro
        {a.source === 'paper' && <p class="text-stone-700">Entered from a paper application.</p>}
```

Also extend that page's `banner` chain with: `: done === 'created' ? 'Paper application entered.'` (the `error=pu_taken` banner already exists there from the town-blocks feature and combines naturally).

`src/pages/admin/applications/export.xlsx.ts` — append `'Source'` as the LAST header and `r.source` as the LAST row cell (both arrays; count them — they must stay equal length).

- [ ] **Step 3: Verify**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`
Expected: all green (page logic is validated in Task 2's tests; page wiring by build — house pattern).

- [ ] **Step 4: Commit**

```bash
git add "src/pages/admin/applications/new.astro" src/pages/admin/applications/index.astro "src/pages/admin/applications/[id].astro" src/pages/admin/applications/export.xlsx.ts
git commit -m "feat(admin): Enter a paper application — lenient admin door into the existing form"
```

---

## After all tasks (not code)

- Ships with the held batch: migrations 0004-0007 apply in one `npm run db:migrate:remote`, then deploy.
- Tell Sherlyn: the button is on the Applications list; only name + town are required; blanks are fine; her notes box on the form is for paper-only details (car, doll, Box #); entering never emails the family.
