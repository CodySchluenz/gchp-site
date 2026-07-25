# Application History (Audit Timeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every change to an application becomes a plain-English sentence row shown as a read-only History timeline on the detail page, plus an as-first-submitted snapshot with a "See the application as first submitted" view.

**Architecture:** Additive migration `0012` (history table + `applications.original_json`). Sentence composition lives in a pure, TDD'd `src/lib/history.ts`; `db.ts` gains `addHistory`/`listHistory`; each existing save path composes rows from the old values it already holds and writes them alongside its save. Display is just printing rows.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Tailwind 4, Cloudflare D1 (SQLite), Vitest. Tests `npm run test`, build `npm run build`, types `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-07-24-application-history-design.md`

## Global Constraints

- History is admin-only PII: never on a public route, never on packing slips or in exports; read-only forever (no UI edits/deletes history rows); lives and dies with its application.
- NOT recorded: page views, downloads, sign-ins (change log, not surveillance).
- `area` values: `application` | `people` | `jobs` | `decision` | `number` | `bags` | `cards` | `notes` | `record` (`record` = received/deleted/restored).
- Actor = `Astro.locals.adminEmail ?? ''`; `''` renders as "the family".
- Times stored ISO UTC, displayed via `centralDateTime` (existing `src/lib/dates.ts`).
- Long free-text fields (good deed, parentage note, gifts textarea on apply, admin notes) log "updated"-style rows WITHOUT old → new values — the timeline stays readable and the original text lives in the snapshot. Short fields log `changed from X to Y`.
- Money renders `$650` / `$15.50` (cents only when present); empty/None renders as `blank`.
- Straight apostrophes only. Plain English, ≥18px admin type.
- Additive migration; routine migrate-first deploy (no special ordering).

---

### Task 1: Migration 0012, db helpers, snapshot + received rows

**Files:**
- Create: `migrations/0012_application_history.sql`, `tests/db-history.test.ts`
- Modify: `tests/helpers/d1.ts:11` (append migration), `tests/d1-schema.test.ts` (one case), `src/lib/db.ts` (`HistoryRow`/`addHistory`/`listHistory`; `insertApplication` gains `original_json` + received row + optional actor param), `src/pages/admin/applications/new.astro` (pass the actor)

**Interfaces:**
- Produces (in `src/lib/db.ts`):

```ts
export type HistoryRow = { id: number; at: string; actor_email: string; area: string; summary: string };
export async function addHistory(db: D1Database, applicationId: number, actorEmail: string, area: string, summary: string, at: string): Promise<void>;
// Multi-row saves: build once, run with db.batch alongside nothing else needed.
export function historyStatements(db: D1Database, applicationId: number, actorEmail: string, area: string, summaries: string[], at: string): D1PreparedStatement[];
export async function listHistory(db: D1Database, applicationId: number): Promise<HistoryRow[]>; // newest first (ORDER BY id DESC)
export async function insertApplication(db: D1Database, app: NewApplication, actorEmail = ''): Promise<number>; // now also stamps original_json + the received history row
```

- [ ] **Step 1: Write the migration**

`migrations/0012_application_history.sql`:

```sql
-- Application history: one plain-English sentence per change, written by the
-- same code paths that save the change. Read-only; admin-only; purged with
-- its application. Sentences are composed at save time so display never
-- depends on schema archaeology.
CREATE TABLE application_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  area TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX idx_history_app ON application_history(application_id, id);
ALTER TABLE applications ADD COLUMN original_json TEXT;
```

Append `'migrations/0012_application_history.sql'` to the array in `tests/helpers/d1.ts:11`.

- [ ] **Step 2: Schema test first**

In `tests/d1-schema.test.ts` add:

```ts
it('application history: table, index, and original_json exist', async () => {
  const t = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'application_history'").first();
  expect(t).not.toBeNull();
  const i = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_history_app'").first();
  expect(i).not.toBeNull();
  const a = await db.prepare('PRAGMA table_info(applications)').all<{ name: string }>();
  expect(a.results.map((c) => c.name)).toContain('original_json');
});
```

Run: `npx vitest run tests/d1-schema.test.ts` — PASS (migration exists from Step 1).

- [ ] **Step 3: Failing db tests**

Create `tests/db-history.test.ts` (mirror `tests/db-cards-given.test.ts` for the harness pattern and copy its `base: NewApplication` fixture shape exactly):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { addHistory, historyStatements, listHistory, insertApplication, type NewApplication } from '../src/lib/db';

describe('application history rows', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('adds and lists newest-first', async () => {
    const id = await insertApplication(db, base);
    await addHistory(db, id, 'a@b.co', 'bags', 'Bag count set to 4', '2026-10-02T00:00:00Z');
    await db.batch(historyStatements(db, id, 'a@b.co', 'application', ['Address changed from 1 Elm to 2 Oak', 'Phone changed from blank to 608'], '2026-10-03T00:00:00Z'));
    const rows = await listHistory(db, id);
    // newest first; the received row from insertApplication is last
    expect(rows[0].summary).toBe('Phone changed from blank to 608');
    expect(rows.at(-1)!.summary).toBe('Application received online');
    expect(rows.at(-1)!.actor_email).toBe('');
    expect(rows.at(-1)!.area).toBe('record');
    expect(rows.at(-1)!.at).toBe(base.submittedAt);
  });

  it('stamps the as-submitted snapshot and the paper actor', async () => {
    const id = await insertApplication(db, { ...base, source: 'paper' }, 'admin@x.co');
    const row = await db.prepare('SELECT original_json FROM applications WHERE id = ?').bind(id).first<{ original_json: string }>();
    const snap = JSON.parse(row!.original_json);
    expect(snap.firstName).toBe(base.firstName);
    expect(snap.members.length).toBe(base.members.length);
    const rows = await listHistory(db, id);
    expect(rows.at(-1)!.summary).toBe('Entered from a paper application');
    expect(rows.at(-1)!.actor_email).toBe('admin@x.co');
  });
});
```

Run — expect FAIL (exports missing).

- [ ] **Step 4: Implement in `src/lib/db.ts`**

Near `setApplicationNotes`:

```ts
// The application's audit timeline: one plain-English sentence per change,
// written by the same code path that saves the change (see src/lib/history.ts
// for the sentence composers). Read-only by design — nothing ever edits or
// deletes these rows; they are removed only when their application is purged.
export type HistoryRow = { id: number; at: string; actor_email: string; area: string; summary: string };

export function historyStatements(
  db: D1Database, applicationId: number, actorEmail: string, area: string, summaries: string[], at: string,
): D1PreparedStatement[] {
  return summaries.map((summary) =>
    db.prepare('INSERT INTO application_history (application_id, at, actor_email, area, summary) VALUES (?, ?, ?, ?, ?)')
      .bind(applicationId, at, actorEmail, area, summary));
}

export async function addHistory(
  db: D1Database, applicationId: number, actorEmail: string, area: string, summary: string, at: string,
): Promise<void> {
  await db
    .prepare('INSERT INTO application_history (application_id, at, actor_email, area, summary) VALUES (?, ?, ?, ?, ?)')
    .bind(applicationId, at, actorEmail, area, summary)
    .run();
}

export async function listHistory(db: D1Database, applicationId: number): Promise<HistoryRow[]> {
  const { results } = await db
    .prepare('SELECT id, at, actor_email, area, summary FROM application_history WHERE application_id = ? ORDER BY id DESC')
    .bind(applicationId)
    .all<HistoryRow>();
  return results;
}
```

`insertApplication` changes:
1. Signature: `export async function insertApplication(db: D1Database, app: NewApplication, actorEmail = ''): Promise<number> {`
2. INSERT gains `original_json` column + one `?`; bind `JSON.stringify(app)` (place it last, after `source`).
3. After the members/employers batch succeeds (just before `return appId;`):

```ts
  await addHistory(
    db, appId, actorEmail, 'record',
    (app.source ?? 'online') === 'paper' ? 'Entered from a paper application' : 'Application received online',
    app.submittedAt,
  );
```

4. `src/pages/admin/applications/new.astro:53` — pass the actor: `await insertApplication(env.DB, { ... }, Astro.locals.adminEmail ?? '');` (`apply.astro` stays as-is — default `''` = the family).

Run Step 3 tests: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm run test`, `npx tsc --noEmit`, `npm run build` — green.

```bash
git add -A
git commit -m "feat(db): application_history table + as-submitted snapshot; received rows stamped on insert"
```

---

### Task 2: The sentence composers — pure `src/lib/history.ts` (TDD)

**Files:**
- Create: `src/lib/history.ts`, `tests/history.test.ts`

**Interfaces:**
- Consumes: `ApplicationFullEdit`, `MemberEdit`, `EmployerEdit`, `CardsGiven` types from `src/lib/db.ts`; `relationshipLabel` from `src/lib/relationships.ts`.
- Produces:

```ts
export function describeApplicationChanges(current: Record<string, unknown>, next: ApplicationFullEdit, cityName: (id: number) => string): string[];
export function describeMemberChange(kind: 'added' | 'removed' | 'restored' | 'updated', current: Record<string, unknown> | null, next: MemberEdit | null): string[];
export function describeEmployerChange(kind: 'added' | 'removed' | 'restored' | 'updated', current: Record<string, unknown> | null, next: EmployerEdit | null): string[];
export function describeCardsChanges(current: Record<string, unknown>, next: CardsGiven): string[];
export function describeBagsChange(oldBags: number | null, newBags: number | null): string | null;
export function describePuChange(oldPu: number | null, newPu: number | null): string | null;
export function describeDecision(kind: 'approved' | 'denied', assignedPu: number | null | undefined, mail: 'sent' | 'failed' | 'none'): string;
```

- [ ] **Step 1: Write the failing tests**

Create `tests/history.test.ts`. Cover every composer; representative cases (write all of these):

```ts
import { describe, it, expect } from 'vitest';
import {
  describeApplicationChanges, describeMemberChange, describeEmployerChange,
  describeCardsChanges, describeBagsChange, describePuChange, describeDecision,
} from '../src/lib/history';
import type { ApplicationFullEdit, MemberEdit, EmployerEdit, CardsGiven } from '../src/lib/db';

const cityName = (id: number) => (id === 13 ? 'Lancaster' : id === 15 ? 'Platteville' : `Town #${id}`);

// A current row and a matching "no changes" edit — build the edit FROM the row.
const row: Record<string, unknown> = {
  first_name: 'Sue', last_name: 'Smith', address: '1 Elm', city_id: 13, phone: '', email: 'a@b.co',
  diabetic: 0, share_with_sponsor: 0, permanently_disabled: 0, bed_choice: 'none', bed_size: null,
  years_received_help: 2, adopted_last_year: 0, household_type: 'family',
  full_time_residence_confirmed: 1, no_employment_confirmed: 1,
  food_share_amount: null, social_security_amount: 800, social_security_for: 'self',
  ssi_amount: null, ssi_for: '', child_support_amount: null, child_support_for: '',
  unemployment_weekly_amount: null, unemployment_for: '', other_income_amount: null, other_income_for: '',
  good_deed: 'Shoveled snow', parentage_note: '',
};
const same: ApplicationFullEdit = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '', email: 'a@b.co',
  diabetic: false, shareWithSponsor: false, permanentlyDisabled: false, bedChoice: 'none', bedSize: null,
  yearsReceivedHelp: 2, adoptedLastYear: false, householdType: 'family',
  fullTimeResidenceConfirmed: true, noEmploymentConfirmed: true,
  foodShareAmount: null, socialSecurityAmount: 800, socialSecurityFor: 'self',
  ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '',
  unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '',
  goodDeed: 'Shoveled snow', parentageNote: '',
};

describe('describeApplicationChanges', () => {
  it('returns no rows when nothing changed', () => {
    expect(describeApplicationChanges(row, same, cityName)).toEqual([]);
  });
  it('describes short-field changes with old and new values', () => {
    const out = describeApplicationChanges(row, {
      ...same, address: '2 Oak', phone: '608-555-0142', cityId: 15,
      socialSecurityAmount: 650, diabetic: true, bedChoice: 'blanket', bedSize: 'full',
    }, cityName);
    expect(out).toContain('Address changed from 1 Elm to 2 Oak');
    expect(out).toContain('Phone changed from blank to 608-555-0142');
    expect(out).toContain('Town changed from Lancaster to Platteville');
    expect(out).toContain('Social Security (monthly) changed from $800 to $650');
    expect(out).toContain('Diabetic changed from No to Yes');
    expect(out).toContain('Bed choice changed from none to blanket');
    expect(out).toContain('Bed size changed from blank to full');
  });
  it('long text logs updated-style without values', () => {
    const out = describeApplicationChanges(row, { ...same, goodDeed: 'Different deed', parentageNote: 'Dad has them Mondays' }, cityName);
    expect(out).toContain('Good deed was edited');
    expect(out).toContain('Blended-family note was edited');
    expect(out.join(' ')).not.toContain('Different deed');
  });
  it('formats cents only when present', () => {
    const out = describeApplicationChanges(row, { ...same, socialSecurityAmount: 650.5 }, cityName);
    expect(out).toContain('Social Security (monthly) changed from $800 to $650.50');
  });
});

const memberRow: Record<string, unknown> = {
  name: 'Tim Smith', relationship: 'son', relationship_other: '', sex: 'M', age: 7,
  disabled: 0, part_time: 0, doll: '', pants: '8', shirt_top: 'M', underwear: '8', socks: '', diapers: '', shoe: '2', coat: 'M', gifts: 'bike',
};
const sameMember: MemberEdit = {
  name: 'Tim Smith', relationship: 'son', relationshipOther: '', sex: 'M', age: 7,
  disabled: false, partTime: false, doll: '', pants: '8', shirtTop: 'M', underwear: '8', socks: '', diapers: '', shoe: '2', coat: 'M', gifts: 'bike',
};

describe('describeMemberChange', () => {
  it('add / remove / restore', () => {
    expect(describeMemberChange('added', null, sameMember)).toEqual(['Person added: Tim Smith']);
    expect(describeMemberChange('removed', memberRow, null)).toEqual(['Tim Smith removed']);
    expect(describeMemberChange('restored', memberRow, null)).toEqual(['Tim Smith restored']);
  });
  it('updates: per-field rows prefixed with the name; rename gets its own row', () => {
    const out = describeMemberChange('updated', memberRow, { ...sameMember, name: 'Timothy Smith', coat: 'L', doll: 'black', age: 8 });
    expect(out).toContain('Person renamed from Tim Smith to Timothy Smith');
    expect(out).toContain('Timothy Smith: coat size changed from M to L');
    expect(out).toContain('Timothy Smith: doll changed from No doll to Black doll');
    expect(out).toContain('Timothy Smith: age changed from 7 to 8');
    expect(describeMemberChange('updated', memberRow, sameMember)).toEqual([]);
  });
});

const employerRow: Record<string, unknown> = { employer_name: 'Acme', worker_name: 'Sue', hourly_wage: 15, hours_per_week: 40 };
const sameEmployer: EmployerEdit = { employerName: 'Acme', workerName: 'Sue', hourlyWage: 15, hoursPerWeek: 40 };

describe('describeEmployerChange', () => {
  it('add / remove / restore / update', () => {
    expect(describeEmployerChange('added', null, sameEmployer)).toEqual(['Job added: Sue at Acme ($15 x 40 hrs)']);
    expect(describeEmployerChange('removed', employerRow, null)).toEqual(['Job at Acme removed']);
    expect(describeEmployerChange('restored', employerRow, null)).toEqual(['Job at Acme restored']);
    const out = describeEmployerChange('updated', employerRow, { ...sameEmployer, hoursPerWeek: 32, hourlyWage: 15.5 });
    expect(out).toContain('Job at Acme: hours per week changed from 40 to 32');
    expect(out).toContain('Job at Acme: hourly wage changed from $15 to $15.50');
    expect(describeEmployerChange('updated', employerRow, sameEmployer)).toEqual([]);
  });
});

describe('cards / bags / pickup number / decision', () => {
  const cardsRow: Record<string, unknown> = { thanksgiving_card: 0, food_card: 0, food_card_amount: null, gift_card: 1, gift_card_amount: 25 };
  it('cards: one row per changed item', () => {
    const out = describeCardsChanges(cardsRow, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: true, giftCardAmount: 40 });
    expect(out).toContain('Thanksgiving card marked given');
    expect(out).toContain('Food card marked given ($50)');
    expect(out).toContain('Gift card amount changed from $25 to $40');
    expect(describeCardsChanges(cardsRow, { thanksgivingCard: false, foodCard: false, foodCardAmount: null, giftCard: true, giftCardAmount: 25 })).toEqual([]);
  });
  it('unmarking', () => {
    const out = describeCardsChanges({ ...cardsRow, thanksgiving_card: 1 }, { thanksgivingCard: false, foodCard: false, foodCardAmount: null, giftCard: true, giftCardAmount: 25 });
    expect(out).toContain('Thanksgiving card unmarked');
  });
  it('bags and pickup number', () => {
    expect(describeBagsChange(null, 5)).toBe('Bag count set to 5');
    expect(describeBagsChange(4, 5)).toBe('Bag count changed from 4 to 5');
    expect(describeBagsChange(4, null)).toBe('Bag count cleared');
    expect(describeBagsChange(4, 4)).toBeNull();
    expect(describePuChange(null, 1610)).toBe('Pickup number set to 1610');
    expect(describePuChange(1604, 1610)).toBe('Pickup number changed from 1604 to 1610');
    expect(describePuChange(1604, null)).toBe('Pickup number cleared');
    expect(describePuChange(1604, 1604)).toBeNull();
  });
  it('decisions', () => {
    expect(describeDecision('approved', 1604, 'sent')).toBe('Approved; pickup number 1604 assigned — email sent');
    expect(describeDecision('approved', null, 'none')).toBe('Approved (no number free in the block)');
    expect(describeDecision('approved', undefined, 'none')).toBe('Approved');
    expect(describeDecision('denied', undefined, 'failed')).toBe('Denied — email could not be sent');
  });
});

describe('copy hygiene', () => {
  it('no curly apostrophes in any composed sentence', () => {
    const all = [
      ...describeApplicationChanges(row, { ...same, address: '2 Oak' }, cityName),
      ...describeMemberChange('added', null, sameMember),
      describeDecision('approved', 1604, 'sent'),
    ].join('');
    expect(all.includes('’')).toBe(false);
  });
});
```

Run: `npx vitest run tests/history.test.ts` — FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/history.ts`**

```ts
// The sentence composers for the application History timeline. Pure functions:
// each takes the CURRENT stored values (snake_case row) and the incoming edit
// (camelCase), and returns plain-English sentences for whatever changed.
// The save paths in the admin routes write these via addHistory/historyStatements.
// Long free-text fields deliberately log "was edited" without values — the
// timeline stays readable, and the original text lives in original_json.
import type { ApplicationFullEdit, MemberEdit, EmployerEdit, CardsGiven } from './db';
import { relationshipLabel } from './relationships';

const money = (v: number | null | undefined): string =>
  v == null ? 'blank' : Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
const blank = (s: string | null | undefined): string => (s == null || s === '' ? 'blank' : s);
const yesNo = (b: boolean): string => (b ? 'Yes' : 'No');
const dollLabel = (d: string | null | undefined): string =>
  d === 'black' ? 'Black doll' : d === 'white' ? 'White doll' : 'No doll';

type Field =
  | { label: string; old: string; next: string }         // compared as strings
  | { label: string; edited: true; old: string; next: string }; // long text: "was edited"

function diff(fields: Field[]): string[] {
  const out: string[] = [];
  for (const f of fields) {
    if (f.old === f.next) continue;
    out.push('edited' in f ? `${f.label} was edited` : `${f.label} changed from ${f.old} to ${f.next}`);
  }
  return out;
}

export function describeApplicationChanges(
  current: Record<string, unknown>, next: ApplicationFullEdit, cityName: (id: number) => string,
): string[] {
  const s = (v: unknown) => blank(v == null ? '' : String(v));
  const n = (v: unknown): number | null => (v == null ? null : Number(v));
  const b = (v: unknown) => yesNo(v === 1 || v === true);
  return diff([
    { label: 'First name', old: s(current.first_name), next: blank(next.firstName) },
    { label: 'Last name', old: s(current.last_name), next: blank(next.lastName) },
    { label: 'Address', old: s(current.address), next: blank(next.address) },
    { label: 'Town', old: cityName(Number(current.city_id)), next: cityName(next.cityId) },
    { label: 'Phone', old: s(current.phone), next: blank(next.phone) },
    { label: 'Email', old: s(current.email), next: blank(next.email) },
    { label: 'Diabetic', old: b(current.diabetic), next: yesNo(next.diabetic) },
    { label: 'OK to share with a sponsor', old: b(current.share_with_sponsor), next: yesNo(next.shareWithSponsor) },
    { label: 'Permanently disabled', old: b(current.permanently_disabled), next: yesNo(next.permanentlyDisabled) },
    { label: 'Bed choice', old: s(current.bed_choice), next: blank(next.bedChoice) },
    { label: 'Bed size', old: s(current.bed_size), next: blank(next.bedSize) },
    { label: 'Years received help', old: s(current.years_received_help), next: String(next.yearsReceivedHelp) },
    { label: 'Adopted last year', old: b(current.adopted_last_year), next: yesNo(next.adoptedLastYear) },
    { label: 'Household type', old: s(current.household_type), next: next.householdType },
    { label: 'Residence confirmed', old: b(current.full_time_residence_confirmed), next: yesNo(next.fullTimeResidenceConfirmed) },
    { label: 'No one employed confirmed', old: b(current.no_employment_confirmed), next: yesNo(next.noEmploymentConfirmed) },
    { label: 'Food Share (monthly)', old: money(n(current.food_share_amount)), next: money(next.foodShareAmount) },
    { label: 'Social Security (monthly)', old: money(n(current.social_security_amount)), next: money(next.socialSecurityAmount) },
    { label: 'Social Security is for', old: s(current.social_security_for), next: blank(next.socialSecurityFor) },
    { label: 'SSI (monthly)', old: money(n(current.ssi_amount)), next: money(next.ssiAmount) },
    { label: 'SSI is for', old: s(current.ssi_for), next: blank(next.ssiFor) },
    { label: 'Child support (monthly)', old: money(n(current.child_support_amount)), next: money(next.childSupportAmount) },
    { label: 'Child support is for', old: s(current.child_support_for), next: blank(next.childSupportFor) },
    { label: 'Unemployment (weekly)', old: money(n(current.unemployment_weekly_amount)), next: money(next.unemploymentWeeklyAmount) },
    { label: 'Unemployment is for', old: s(current.unemployment_for), next: blank(next.unemploymentFor) },
    { label: 'Other income (monthly)', old: money(n(current.other_income_amount)), next: money(next.otherIncomeAmount) },
    { label: 'Other income is for', old: s(current.other_income_for), next: blank(next.otherIncomeFor) },
    { label: 'Good deed', edited: true, old: String(current.good_deed ?? ''), next: next.goodDeed },
    { label: 'Blended-family note', edited: true, old: String(current.parentage_note ?? ''), next: next.parentageNote },
  ]);
}

export function describeMemberChange(
  kind: 'added' | 'removed' | 'restored' | 'updated',
  current: Record<string, unknown> | null, next: MemberEdit | null,
): string[] {
  if (kind === 'added') return [`Person added: ${next!.name}`];
  const oldName = String(current!.name ?? '');
  if (kind === 'removed') return [`${oldName} removed`];
  if (kind === 'restored') return [`${oldName} restored`];
  const m = next!;
  const out: string[] = [];
  if (oldName !== m.name) out.push(`Person renamed from ${oldName} to ${m.name}`);
  const who = m.name;
  const s = (v: unknown) => blank(v == null ? '' : String(v));
  const rel = (v: string, other: string) => (v === '' ? 'blank' : relationshipLabel(v, other));
  const fields: [string, string, string][] = [
    ['relationship', rel(String(current!.relationship ?? ''), String(current!.relationship_other ?? '')), rel(m.relationship, m.relationshipOther ?? '')],
    ['sex', s(current!.sex), blank(m.sex)],
    ['age', s(current!.age), String(m.age)],
    ['permanently disabled', yesNo(current!.disabled === 1), yesNo(m.disabled === true)],
    ['lives here part of the time', yesNo(current!.part_time === 1), yesNo(m.partTime === true)],
    ['doll', dollLabel(String(current!.doll ?? '')), dollLabel(m.doll ?? '')],
    ['pants size', s(current!.pants), blank(m.pants)],
    ['shirt size', s(current!.shirt_top), blank(m.shirtTop)],
    ['underwear size', s(current!.underwear), blank(m.underwear)],
    ['socks size', s(current!.socks), blank(m.socks)],
    ['diapers size', s(current!.diapers), blank(m.diapers)],
    ['shoe size', s(current!.shoe), blank(m.shoe ?? '')],
    ['coat size', s(current!.coat), blank(m.coat ?? '')],
    ['gifts wanted', s(current!.gifts), blank(m.gifts)],
  ];
  for (const [label, oldV, newV] of fields) {
    if (oldV !== newV) out.push(`${who}: ${label} changed from ${oldV} to ${newV}`);
  }
  return out;
}

export function describeEmployerChange(
  kind: 'added' | 'removed' | 'restored' | 'updated',
  current: Record<string, unknown> | null, next: EmployerEdit | null,
): string[] {
  if (kind === 'added') return [`Job added: ${next!.workerName} at ${next!.employerName} (${money(next!.hourlyWage)} x ${next!.hoursPerWeek} hrs)`];
  const at = String(current!.employer_name ?? '');
  if (kind === 'removed') return [`Job at ${at} removed`];
  if (kind === 'restored') return [`Job at ${at} restored`];
  const e = next!;
  const out: string[] = [];
  const fields: [string, string, string][] = [
    ['employer', at, e.employerName],
    ['worker', String(current!.worker_name ?? ''), e.workerName],
    ['hourly wage', money(Number(current!.hourly_wage)), money(e.hourlyWage)],
    ['hours per week', String(current!.hours_per_week ?? ''), String(e.hoursPerWeek)],
  ];
  for (const [label, oldV, newV] of fields) {
    if (oldV !== newV) out.push(`Job at ${at}: ${label} changed from ${oldV} to ${newV}`);
  }
  return out;
}

export function describeCardsChanges(current: Record<string, unknown>, next: CardsGiven): string[] {
  const out: string[] = [];
  const mark = (label: string, oldOn: boolean, newOn: boolean, newAmount: number | null) => {
    if (oldOn === newOn) return;
    out.push(newOn ? `${label} marked given${newAmount != null ? ` (${money(newAmount)})` : ''}` : `${label} unmarked`);
  };
  mark('Thanksgiving card', current.thanksgiving_card === 1, next.thanksgivingCard, null);
  mark('Food card', current.food_card === 1, next.foodCard, next.foodCardAmount);
  mark('Gift card', current.gift_card === 1, next.giftCard, next.giftCardAmount);
  const amount = (label: string, oldV: number | null, newV: number | null, justMarked: boolean) => {
    if (justMarked || oldV === newV) return;
    out.push(`${label} amount changed from ${money(oldV)} to ${money(newV)}`);
  };
  amount('Food card', current.food_card_amount as number | null, next.foodCardAmount, current.food_card !== 1 && next.foodCard);
  amount('Gift card', current.gift_card_amount as number | null, next.giftCardAmount, current.gift_card !== 1 && next.giftCard);
  return out;
}

export function describeBagsChange(oldBags: number | null, newBags: number | null): string | null {
  if (oldBags === newBags) return null;
  if (newBags == null) return 'Bag count cleared';
  if (oldBags == null) return `Bag count set to ${newBags}`;
  return `Bag count changed from ${oldBags} to ${newBags}`;
}

export function describePuChange(oldPu: number | null, newPu: number | null): string | null {
  if (oldPu === newPu) return null;
  if (newPu == null) return 'Pickup number cleared';
  if (oldPu == null) return `Pickup number set to ${newPu}`;
  return `Pickup number changed from ${oldPu} to ${newPu}`;
}

export function describeDecision(
  kind: 'approved' | 'denied', assignedPu: number | null | undefined, mail: 'sent' | 'failed' | 'none',
): string {
  let base = kind === 'approved' ? 'Approved' : 'Denied';
  if (kind === 'approved' && assignedPu != null) base = `Approved; pickup number ${assignedPu} assigned`;
  if (kind === 'approved' && assignedPu === null) base = 'Approved (no number free in the block)';
  if (mail === 'sent') return `${base} — email sent`;
  if (mail === 'failed') return `${base} — email could not be sent`;
  return base;
}
```

Run Step 1 tests: PASS. Then `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/history.ts tests/history.test.ts
git commit -m "feat(history): pure sentence composers for the application timeline (TDD)"
```

---

### Task 3: Detail-page actions, restore, the History section, and the original view

**Files:**
- Modify: `src/pages/admin/applications/[id].astro`, `src/pages/admin/applications/[id]/restore.ts`
- Create: `src/pages/admin/applications/[id]/original.astro`
- Test: extend `tests/db-history.test.ts` with one representative flow test

**Interfaces:**
- Consumes: Task 1's `addHistory`/`historyStatements`/`listHistory`; Task 2's composers; `Astro.locals.adminEmail`; `centralDateTime` from `src/lib/dates.ts`.

- [ ] **Step 1: Wire every action in `[id].astro`'s POST block**

At the top of the POST handling add `const actor = Astro.locals.adminEmail ?? '';` and `const now = new Date().toISOString();`. The POST block already fetches the current application (it reads `email`/`firstName`/`season` — reuse that fetch; extend it to grab `status`, `pu_number`, `bags_count`, `thanksgiving_card`, `food_card`, `food_card_amount`, `gift_card`, `gift_card_amount` if not already a full-row read). Then per branch, AFTER the existing save succeeds:

- approve (`approve_email` / `approve_silent`): `await addHistory(env.DB, id, actor, 'decision', describeDecision('approved', assigned, act === 'approve_email' ? (r.sent ? 'sent' : 'failed') : 'none'), now);` — mind that the email branch computes `r` before redirecting; place the history write before each redirect.
- deny branches: same with `describeDecision('denied', undefined, ...)`.
- `set_bags`: `const line = describeBagsChange(oldBags, newBags); if (line) await addHistory(env.DB, id, actor, 'bags', line, now);` (compute `newBags` once and reuse for both the save and the sentence).
- `set_notes`: `await addHistory(env.DB, id, actor, 'notes', 'Your notes were updated', now);`
- `set_pu`: use `describePuChange(oldPu, newPu)` — only on the success paths (saved or cleared), not on `pu_bad`/`pu_taken` errors.
- `set_straggler`: write `'Marked as a straggler'` or `'Straggler mark removed'` (area `number`) only when the value actually changed.
- `set_cards`: `const lines = describeCardsChanges(currentRow, cards); if (lines.length) await env.DB.batch(historyStatements(env.DB, id, actor, 'cards', lines, now));`
- `delete`: `await addHistory(env.DB, id, actor, 'record', 'Application deleted', now);` (after the soft-delete).

- [ ] **Step 2: Restore route**

`src/pages/admin/applications/[id]/restore.ts` — after `restoreApplication(...)`:

```ts
  await addHistory(locals.runtime.env.DB, id, locals.adminEmail ?? '', 'record', 'Application restored', new Date().toISOString());
```

(add `addHistory` to the imports).

- [ ] **Step 3: The History section (display)**

In `[id].astro`'s GET side: `const history = detail ? await listHistory(env.DB, id) : [];` and `const hasOriginal = typeof a.original_json === 'string' && a.original_json !== '';`. Render AFTER the Cards given section:

```astro
      <section class="mt-8 rounded-lg border-2 border-stone-300 bg-white p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 class="text-2xl font-bold text-holly-800">History</h2>
          {hasOriginal && (
            <a href={`/admin/applications/${id}/original`} class="font-semibold text-berry-700 underline">See the application as first submitted</a>
          )}
        </div>
        <p class="mt-1 text-stone-600">Every change to this application, newest first. Only you see this.</p>
        {history.length === 0 ? (
          <p class="mt-3 text-lg text-stone-700">History began July 2026 — earlier changes weren't recorded.</p>
        ) : (
          <ul class="mt-3 space-y-2">
            {history.map((h) => (
              <li class="border-b border-stone-200 pb-2 text-lg">
                <span class="whitespace-nowrap font-semibold text-holly-800">{centralDateTime(h.at)}</span>
                {' — '}{h.summary}
                <span class="text-stone-600"> — {h.actor_email === '' ? 'the family' : h.actor_email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
```

(Import `listHistory` and `centralDateTime` alongside the existing imports.)

- [ ] **Step 4: The original view**

Create `src/pages/admin/applications/[id]/original.astro` — read-only, print-friendly, plain style of the detail page. Skeleton (fill the render from the snapshot's `NewApplication` shape — the same field names `insertApplication` receives):

```astro
---
import '../../../../styles/global.css';
import Admin from '../../../../layouts/Admin.astro';
import { getApplicationDetail, listCities, type NewApplication } from '../../../../lib/db';
import { centralDateTime } from '../../../../lib/dates';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);
const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;
const a = detail?.app ?? {} as Record<string, unknown>;
let snap: NewApplication | null = null;
try { snap = typeof a.original_json === 'string' && a.original_json !== '' ? JSON.parse(a.original_json) : null; } catch { snap = null; }
const cities = await listCities(env.DB);
const town = snap ? (cities.find((c) => c.id === snap!.cityId)?.name ?? '') : '';
const money = (v: number | null) => (v == null ? '—' : `$${v}`);
const dollWord = (d?: string) => (d === 'black' ? 'Black doll' : d === 'white' ? 'White doll' : '—');
---
<Admin title="As first submitted" heading={detail ? `As first submitted — ${a.first_name} ${a.last_name}` : 'Not found'} back={{ href: `/admin/applications/${id}`, label: 'Back to the application' }}>
  {!detail ? <p class="mt-4">That application could not be found.</p> : !snap ? (
    <p class="mt-4 text-lg">This application predates history tracking, so there is no saved original.</p>
  ) : (
    <>
      <div class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4" role="note">
        <p class="text-lg font-semibold">This is the application exactly as first submitted on {centralDateTime(snap.submittedAt)} — read-only.
          The application page shows the current, possibly corrected, version.</p>
      </div>
      <!-- Render snap: name/address/town/phone/email; household type; bed; benefits amounts+for;
           employers (worker at employer, $wage x hours); members table (name, relationship,
           sex, age, sizes, doll via dollWord, gifts); good deed; parentage note.
           Use the detail page's plain sections/table styling; no forms, no buttons. -->
    </>
  )}
</Admin>
```

Replace the placeholder comment with the actual sections — mirror the detail page's People table markup and Income facts layout, reading from `snap.members`, `snap.employers`, `snap.benefits`, `snap.goodDeed`, `snap.parentageNote`.

- [ ] **Step 5: Representative flow test**

In `tests/db-history.test.ts` add:

```ts
  it('a save flow writes composed rows that list back newest-first', async () => {
    const id = await insertApplication(db, base);
    const lines = ['Approved; pickup number 803 assigned', 'Bag count set to 4'];
    await db.batch(historyStatements(db, id, 'admin@x.co', 'decision', [lines[0]], '2026-11-01T00:00:00Z'));
    await addHistory(db, id, 'admin@x.co', 'bags', lines[1], '2026-11-02T00:00:00Z');
    const rows = await listHistory(db, id);
    expect(rows.map((r) => r.summary).slice(0, 2)).toEqual([lines[1], lines[0]]);
    // History must survive the application's soft-delete and restore untouched.
    await softDeleteApplication(db, id, '2026-11-03T00:00:00Z');
    await restoreApplication(db, id);
    expect((await listHistory(db, id)).length).toBe(rows.length);
  });
```

(Add `softDeleteApplication, restoreApplication` to the file's imports.)

- [ ] **Step 6: Verify and commit**

Run: `npm run test`, `npx tsc --noEmit`, `npm run build` — green.

```bash
git add -A
git commit -m "feat(admin): History timeline + as-first-submitted view; detail actions and restores write history"
```

---

### Task 4: Wire the three editors (application, people, jobs)

**Files:**
- Modify: `src/pages/admin/applications/[id]/edit.astro`, `src/pages/admin/applications/[id]/members.astro`, `src/pages/admin/applications/[id]/employers.astro`, `src/pages/admin/applications/[id]/members/[mid]/restore.ts`, `src/pages/admin/applications/[id]/employers/[eid]/restore.ts`

**Interfaces:**
- Consumes: Task 2 composers; Task 1 `addHistory`/`historyStatements`; `Astro.locals.adminEmail`.

- [ ] **Step 1: `edit.astro`**

The POST currently calls `updateApplicationFull` without reading the current row. Change to:

```ts
  const detail = await getApplicationDetail(env.DB, id);
  if (!detail) return Astro.redirect('/admin/applications', 303);
  // ... existing parsing builds `edit` ...
  const cities = await listCities(env.DB);
  const cityName = (cid: number) => cities.find((c) => c.id === cid)?.name ?? `Town #${cid}`;
  const lines = describeApplicationChanges(detail.app, edit, cityName);
  await updateApplicationFull(env.DB, id, edit);
  if (lines.length > 0) {
    await env.DB.batch(historyStatements(env.DB, id, Astro.locals.adminEmail ?? '', 'application', lines, new Date().toISOString()));
  }
  return Astro.redirect(`/admin/applications/${id}`, 303);
```

(`getApplicationDetail` and `listCities` are already imported; add `describeApplicationChanges` and `historyStatements`.)

- [ ] **Step 2: `members.astro`**

The POST already fetches `detail` before acting. Add `const actor = Astro.locals.adminEmail ?? '';` and `const now = new Date().toISOString();`:
- `delete`: before the soft-delete, find the member: `const current = detail.members.find((x) => Number(x.id) === memberId) ?? null;` — after deleting, `if (current) await env.DB.batch(historyStatements(env.DB, id, actor, 'people', describeMemberChange('removed', current, null), now));`
- `create`: after `insertMember`, write `describeMemberChange('added', null, m)`.
- `update`: find `current` the same way; after `updateMember`, `const lines = describeMemberChange('updated', current, m); if (current && lines.length) await env.DB.batch(...area 'people'...);`

- [ ] **Step 3: `employers.astro`**

Identical pattern with `describeEmployerChange` and `detail.employers.find((x) => Number(x.id) === employerId)`, area `jobs`.

- [ ] **Step 4: The two restore routes**

`members/[mid]/restore.ts`: after `restoreMember`, fetch the name and write the row:

```ts
    const m = await locals.runtime.env.DB.prepare('SELECT name FROM household_members WHERE id = ? AND application_id = ?').bind(mid, id).first<{ name: string }>();
    if (m) await addHistory(locals.runtime.env.DB, id, locals.adminEmail ?? '', 'people', `${m.name} restored`, new Date().toISOString());
```

`employers/[eid]/restore.ts`: same shape with `SELECT employer_name` and `` `Job at ${e.employer_name} restored` `` (area `jobs`). (These match the composers' restore sentences; using the tiny inline query avoids fetching the whole detail.)

- [ ] **Step 5: Verify and commit**

Run: `npm run test` (all suites), `npx tsc --noEmit`, `npm run build` — green. Manually trace one flow in the code (edit a field → sentence composed from `detail.app` before `updateApplicationFull` overwrites it — ORDER MATTERS: compose before saving or the diff reads the new values).

```bash
git add -A
git commit -m "feat(admin): application, people, and jobs editors write history rows"
```

---

## After all tasks (controller/owner, not code)

- Final whole-branch review, then routine deploy when the owner chooses: `npm run db:migrate:remote` (0012, additive) then build + deploy — standard migrate-first, no special ordering.
- Operator guide (🎄) + operations manual (📖) artifacts: add the History section + "as first submitted" view (controller does this with the Artifact tool after deploy).
- Existing applications start with an empty timeline by design (no retroactive rows/snapshots).

## Self-review notes (checked against the spec)

- Spec write-path table → Task 1 (received), Task 3 (decisions, number, straggler, bags, cards, notes, delete/restore, display, original view), Task 4 (application/people/jobs edits). Spec lib § → Task 2. Spec testing § → Tasks 1–3 tests; route wiring is build-verified per house pattern with representative D1 flow tests.
- Straggler sentences live inline in `[id].astro` (fixed strings, no logic) — consistent with the spec's "small formatters" latitude; everything with branching is in the tested lib.
- Type coherence: composers consume snake_case current rows + the exact camelCase edit types from `db.ts`; `describeCardsChanges` takes the same `CardsGiven` shape `setCardsGiven` takes; `historyStatements` returns `D1PreparedStatement[]` for `db.batch`.
- Order-of-operations hazard called out explicitly in Task 4 Step 5 (compose diffs BEFORE saving).
