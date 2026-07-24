# Season Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all automated eligibility checking (income check + old flag) and box cards; turn pickup slips into volunteer "packing slips" (no bags/gifts/sponsor, 3 large per page); add a per-child black/white doll choice; add admin-entered food-card/gift-card/Thanksgiving tracking with an X-of-30 counter; replace the Excel download with Sherlyn's exact 11-column sheet plus a full backup export.

**Architecture:** Two migrations split by direction — `0010` additive (doll + five tracking columns, applied before code ships), `0011` destructive (drops `income_limits`, applied after). Pure export-column functions in a new `src/lib/export-columns.ts` so both xlsx routes stay thin and testable. Everything else follows existing house patterns (CSRF'd POST actions on the detail page, SQL aggregates in `listApplicationsForExport`, source-scan tests for pinned guarantees).

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Tailwind 4, Cloudflare D1 (SQLite), Vitest, wrangler 4. Tests `npm run test` (vitest), build `npm run build`, types `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-07-23-season-revisions-design.md`

## Global Constraints

- The software never decides eligibility and never auto-denies; after this plan it computes NO eligibility observation of any kind.
- Applicant form: works with JavaScript disabled; new fields always visible and optional; never wipe what the applicant typed; warm, low-reading-level copy.
- Admin: ≥18px type, plain English, text-labeled buttons, CSRF on every mutating POST, `Cache-Control: no-store` (middleware-provided).
- Packing slips (volunteer-facing) must never contain: bags, gifts, good deeds, income (amounts or status), parentage notes, admin notes, sponsor flag.
- Doll canonical values: `''` | `'black'` | `'white'` (column `household_members.doll`).
- Sherlyn's export headers, verbatim: `tNo`, `{season} Applicant` (e.g. `2026 Applicant`), `Address`, `Special Gift`, `adopted`, `Thanksgiving`, `Food Card/Cert.`, `Amount`, `Gift Cards`, `GC Amount`, `NO. in HH`.
- `THANKSGIVING_CARD_TOTAL = 30`.
- Straight apostrophes only in code copy. CSP: no inline handlers/scripts.
- Do NOT touch `scripts/migrate/**` (the one-time legacy importer still writes `may_not_be_eligible`; the column deliberately stays in the DB, inert).
- Route paths for slips do not change — labels only.

---

### Task 1: Migrations 0010 + 0011, harness, and the full eligibility removal sweep

Remove the income-check feature and the old `mayNotBeEligible` flag from all of `src/` and `tests/`, keeping the suite green. This is one task because the removals are interdependent (deleting the lib breaks every consumer).

**Files:**
- Create: `migrations/0010_dolls_and_cards.sql`, `migrations/0011_drop_income_limits.sql`, `tests/removed-features.test.ts`
- Delete: `src/lib/income-check.ts`, `src/lib/validation/income-limits.ts`, `src/pages/admin/income-limits/index.astro` (and the now-empty `income-limits/` directory), `tests/income-check.test.ts`, `tests/income-limits-validation.test.ts`, `tests/db-income-limits.test.ts`
- Modify: `tests/helpers/d1.ts:11`, `src/lib/eligibility.ts`, `tests/eligibility.test.ts`, `src/lib/db.ts`, `src/pages/apply.astro`, `src/pages/admin/applications/new.astro`, `src/pages/admin/applications/[id]/edit.astro`, `src/pages/admin/applications/index.astro`, `src/pages/admin/applications/[id].astro`, `src/pages/admin/applications/export.xlsx.ts`, `src/components/admin/AdminNav.astro:10`, `src/components/admin/AdminHome.astro:69-71`, `tests/d1-schema.test.ts`, plus mechanical fixture cleanup in the test files listed in Step 8.

**Interfaces:**
- Consumes: current schema (0001–0009).
- Produces: columns `household_members.doll`, `applications.thanksgiving_card/food_card/food_card_amount/gift_card/gift_card_amount` (used by Tasks 4–6); `income_limits` dropped; `NewApplication`, `ApplicationFullEdit`, `ApplicationListRow`, `ExportRow` no longer carry eligibility fields; `eligibility.ts` exports ONLY `suggestHouseholdType`.

- [ ] **Step 1: Write both migrations**

`migrations/0010_dolls_and_cards.sql`:

```sql
-- Season revisions (2026-07-23 spec §3-§4): per-child doll choice + the
-- food/gift-card and Thanksgiving tracking Sherlyn keeps by hand today.
-- ADDITIVE: apply BEFORE deploying the code that reads these columns.
ALTER TABLE household_members ADD COLUMN doll TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN thanksgiving_card INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN food_card INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN food_card_amount REAL;
ALTER TABLE applications ADD COLUMN gift_card INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN gift_card_amount REAL;
```

`migrations/0011_drop_income_limits.sql`:

```sql
-- Season revisions (2026-07-23 spec §1): Sherlyn verifies eligibility fully
-- by hand — the income-check feature is removed. DESTRUCTIVE: apply AFTER
-- the new code is deployed (the old code reads income_limits on every
-- admin applications screen and would 500).
-- applications.may_not_be_eligible is deliberately LEFT in place, inert
-- (NOT NULL DEFAULT 0): dropping it would break the still-deployed old
-- code's INSERTs during the migrate->deploy window.
DROP TABLE income_limits;
```

- [ ] **Step 2: Add both to the harness migration list**

In `tests/helpers/d1.ts:11` append to the array:

```ts
'migrations/0010_dolls_and_cards.sql', 'migrations/0011_drop_income_limits.sql'
```

- [ ] **Step 3: Update the schema test first and watch it fail**

In `tests/d1-schema.test.ts`: delete any case asserting the `income_limits` table exists, and add:

```ts
it('season revisions: income_limits is gone; doll and card columns exist', async () => {
  const t = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'income_limits'").first();
  expect(t).toBeNull();
  const m = await db.prepare('PRAGMA table_info(household_members)').all<{ name: string }>();
  expect(m.results.map((c) => c.name)).toContain('doll');
  const a = await db.prepare('PRAGMA table_info(applications)').all<{ name: string }>();
  const names = a.results.map((c) => c.name);
  for (const col of ['thanksgiving_card', 'food_card', 'food_card_amount', 'gift_card', 'gift_card_amount']) {
    expect(names).toContain(col);
  }
  expect(names).toContain('may_not_be_eligible'); // deliberately inert, still present
});
```

Run: `npx vitest run tests/d1-schema.test.ts` — the new case PASSES already (migrations exist from Step 1) but the OLD income_limits-exists case FAILS; delete that old case, re-run, expect all PASS.

- [ ] **Step 4: Delete the income-check files**

```bash
git rm src/lib/income-check.ts src/lib/validation/income-limits.ts src/pages/admin/income-limits/index.astro tests/income-check.test.ts tests/income-limits-validation.test.ts tests/db-income-limits.test.ts
```

- [ ] **Step 5: Reduce `eligibility.ts` to `suggestHouseholdType` only**

Replace the whole of `src/lib/eligibility.ts` with:

```ts
// The form NEVER decides or flags eligibility (owner decisions 2026-07-12
// and 2026-07-23): Sherlyn verifies every application by hand. This helper
// only suggests the household TYPE, which routes elderly/disabled
// households to the mailed 2500 pickup block — workflow, not eligibility.

type HouseholdShape = { permanentlyDisabled: boolean; members: { age: number }[] };

export function suggestHouseholdType(app: HouseholdShape): 'family' | 'elderly' | 'disabled' {
  if (app.permanentlyDisabled) return 'disabled';
  if ((app.members[0]?.age ?? 0) >= 65) return 'elderly';
  return 'family';
}
```

In `tests/eligibility.test.ts`: delete every `mayNotBeEligible` case and its import; keep the `suggestHouseholdType` cases.

- [ ] **Step 6: Strip eligibility from `src/lib/db.ts`**

All by anchor (line numbers are pre-edit):
1. Delete `getIncomeLimits` (~line 38) and `saveIncomeLimits` (~line 56) plus any `IncomeLimits` import at the top of the file.
2. `NewApplication` (~111): delete `mayNotBeEligible: boolean;`.
3. `insertApplication` (~119): remove `may_not_be_eligible` from the column list, one `?` from VALUES, and `app.mayNotBeEligible ? 1 : 0,` from `.bind(...)`.
4. `ApplicationListRow` (~194): delete the fields `may_not_be_eligible`, `employment_yearly`, `food_share_amount`, `social_security_amount`, `ssi_amount`, `child_support_amount`, `unemployment_weekly_amount`, `other_income_amount`, `member_count` (all existed only to feed `quickIncomeCheck`).
5. `listApplications` (~221): in `cols`, remove `a.may_not_be_eligible`, the six `a.*_amount` columns, and both subselects (`member_count`, `employment_yearly`).
6. `ApplicationFullEdit` (~430): delete `mayNotBeEligible: boolean;`. In `updateApplicationFull`, remove `may_not_be_eligible = ?` from SET and `f.mayNotBeEligible ? 1 : 0,` from bind.
7. `ExportRow` (~497): delete `may_not_be_eligible` and `employment_yearly`.
8. `listApplicationsForExport` (~531): remove `a.may_not_be_eligible` from the SELECT and the whole `employment_yearly` subselect (including its `// x52 must match...` comment and the string concatenation that carries it).

- [ ] **Step 7: Strip eligibility from the pages**

1. `src/pages/apply.astro:12` — change to `import { suggestHouseholdType } from '../lib/eligibility';`; at ~line 89 delete `mayNotBeEligible: mayNotBeEligible(result.clean),`.
2. `src/pages/admin/applications/new.astro:7` — delete the `mayNotBeEligible` import line; at ~line 59 delete `mayNotBeEligible: mayNotBeEligible(result.clean),`.
3. `src/pages/admin/applications/[id]/edit.astro:47` — delete `mayNotBeEligible: on('may_not_be_eligible'),`; delete the whole checkbox label at ~line 108 (`Flag: may not be eligible (needs a closer look)`).
4. `src/pages/admin/applications/index.astro` — remove `getIncomeLimits` from the db import (line 4) and the whole line-6 income-check import; delete lines ~35–45 (`incomeLimits`, `rowBenefits`, `overLimit`); delete the no-limits banner block (~90–96); delete the `Income check` `<th>` (~169) and the `overLimit(r)` `<td>` (~187); delete the `Check eligibility` badge span (~180); fix the empty-row `colspan` from `7 : 6` to `6 : 5` (~174).
5. `src/pages/admin/applications/[id].astro` — remove `getIncomeLimits` from the db import (line 5) and the `checkIncome` import (line 11); delete the `incomeLimits`/`income` computation block (~91–116, keep `const num...` only if still referenced — it is not; delete it too, and keep `const dollars` only if still referenced — it is not; delete); delete the whole `Income check` section (~196–223, from its `<h2 ...>Income check</h2>` wrapper `<section>`/`<div>` open to close). The plain `Income` facts section (~187–193) STAYS.
6. `src/pages/admin/applications/export.xlsx.ts` — remove imports of `getIncomeLimits` and the income-check module; delete the `limits`/`incomeFlag` block (~25–34); remove `'Check eligibility'` and `'Income check'` from `headers` and the matching `r.may_not_be_eligible === 1 ? 'yes' : ''` and `incomeFlag(r)` entries from the row array. (Task 6 rewrites this file entirely; here it only has to build green.)
7. `src/components/admin/AdminNav.astro:10` — delete the `{ href: '/admin/income-limits', label: 'Income limits' },` entry.
8. `src/components/admin/AdminHome.astro:69-71` — delete the whole Income-limits `<a>` card block.

- [ ] **Step 8: Mechanical fixture cleanup across tests**

In each of these files, delete the `mayNotBeEligible: <true|false>,` property from `NewApplication`/fixture objects and any assertion on `may_not_be_eligible`, `employment_yearly`, or list-row benefit amounts (e.g. `db-admin-list.test.ts` asserts `employment_yearly`/`member_count` on list rows — delete those expectations):
`tests/db-admin-actions.test.ts`, `tests/db-admin-detail.test.ts`, `tests/db-admin-export.test.ts`, `tests/db-admin-list.test.ts`, `tests/db-admin-slips.test.ts`, `tests/db-application-edit.test.ts`, `tests/db-application-relationships.test.ts`, `tests/db-application.test.ts`, `tests/db-decided-at.test.ts`, `tests/db-employers.test.ts`, `tests/db-latest-season.test.ts`, `tests/db-members.test.ts`, `tests/db-pickup-blocks.test.ts`, `tests/db-pu.test.ts`, `tests/db-search-escape.test.ts`, `tests/db-soft-delete-members.test.ts`, `tests/db-source.test.ts`, `tests/db-town-pickup-days.test.ts`.
Example diff shape (every file, same pattern):

```diff
   goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z',
-  mayNotBeEligible: false, householdType: 'family',
+  householdType: 'family',
```

Do NOT touch `scripts/migrate/**`.

- [ ] **Step 9: Write the removed-features scan test**

Create `tests/removed-features.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Sherlyn's 2026-07-23 decision: NO automated eligibility of any kind.
// This scan keeps removed features from creeping back into shipped code.
const FORBIDDEN = ['income-check', 'incomeCheck', 'IncomeLimits', 'getIncomeLimits', 'quickIncomeCheck', 'mayNotBeEligible'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|astro|js|mjs)$/.test(name) ? [p] : [];
  });
}

describe('removed features stay removed', () => {
  it('no eligibility-check tokens in src/ or public/', () => {
    const hits: string[] = [];
    for (const file of [...walk('src'), ...walk('public')]) {
      const text = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        if (text.includes(token)) hits.push(`${file}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
```

Run: `npx vitest run tests/removed-features.test.ts` — expect PASS (after Steps 4–7).

- [ ] **Step 10: Full verification**

Run: `npm run test` (expect all pass), `npx tsc --noEmit` (exit 0), `npm run build` (green).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat!: remove all automated eligibility — income check + old flag gone, 0010 adds doll/card columns, 0011 drops income_limits"
```

---

### Task 2: Remove the box-cards feature

**Files:**
- Delete: `src/pages/admin/applications/cards.astro`, `src/pages/admin/applications/[id]/card.astro`, `src/lib/box-cards.ts`, `tests/box-cards.test.ts`
- Modify: `src/pages/admin/applications/index.astro:155`, `src/pages/admin/applications/[id].astro:230-236`, `src/pages/admin/applications/slips.astro:40`, `tests/removed-features.test.ts`

**Interfaces:**
- Consumes: Task 1's `removed-features.test.ts`.
- Produces: no box-card routes/lib; the mailed-household notes no longer mention box cards.

- [ ] **Step 1: Extend the scan test and watch it fail**

In `tests/removed-features.test.ts` add to `FORBIDDEN`: `'box-cards'`, `'boxCard'`, `'Print box card'`.
Run: `npx vitest run tests/removed-features.test.ts` — expect FAIL (hits in `cards.astro`, `[id]/card.astro`, `index.astro`, `[id].astro`, `box-cards.ts`).

- [ ] **Step 2: Delete the feature**

```bash
git rm src/pages/admin/applications/cards.astro "src/pages/admin/applications/[id]/card.astro" src/lib/box-cards.ts tests/box-cards.test.ts
```

- [ ] **Step 3: Remove the buttons and fix mailed-household wording**

1. `index.astro:155` — delete the `Print box cards` `<a>` line.
2. `[id].astro` (~230–236) — delete the `Print box card` `<a>`; change the mailed note to: `Mailed household — no packing slip; gift and food cards go by mail.`
3. `slips.astro:40` — change the mailed paragraph to: `Mailed households don't get packing slips — they receive gift and food cards by mail. Use the applications list's "Elderly &amp; disabled (mailed)" view to print the mail list with addresses.`

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run tests/removed-features.test.ts` (PASS), `npm run test`, `npx tsc --noEmit`, `npm run build` — all green.

```bash
git add -A
git commit -m "feat!: remove box cards — Sherlyn doesn't want the feature"
```

---

### Task 3: Packing slips — rename, reshape, 3 per page, privacy pin

**Files:**
- Modify: `src/components/admin/SlipCard.astro`, `src/pages/admin/applications/slips.astro`, `src/pages/admin/applications/[id]/slip.astro`, `src/pages/admin/applications/[id].astro:235`, `src/pages/admin/applications/index.astro:154`
- Create: `tests/slip-privacy.test.ts`
- Check: `tests/db-admin-slips.test.ts` (adjust any assertion on slip gifts)

**Interfaces:**
- Consumes: `SlipCard` props (`ApplicationDetail`) — unchanged.
- Produces: volunteer-safe slip markup; every operator-visible label says "packing slip".

- [ ] **Step 1: Write the failing privacy test**

Create `tests/slip-privacy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The packing slip is VOLUNTEER-facing (2026-07-23 spec): it must never
// carry income, good deeds, notes, sponsor status, bags, or gifts.
const FORBIDDEN = [
  'bags_count', 'gifts', 'good_deed', 'admin_notes', 'parentage_note',
  'share_with_sponsor', 'food_share', 'social_security', 'ssi_amount',
  'child_support', 'unemployment', 'other_income',
];

describe('packing slip privacy', () => {
  it('SlipCard.astro contains no volunteer-forbidden fields', () => {
    const src = readFileSync('src/components/admin/SlipCard.astro', 'utf8');
    const hits = FORBIDDEN.filter((t) => src.includes(t));
    expect(hits).toEqual([]);
  });
});
```

Run: `npx vitest run tests/slip-privacy.test.ts` — expect FAIL (`bags_count`, `gifts`, `share_with_sponsor` present).

- [ ] **Step 2: Reshape `SlipCard.astro`**

Replace the component with (full file):

```astro
---
import type { ApplicationDetail } from '../../lib/db';
interface Props { detail: ApplicationDetail }
const { detail } = Astro.props;
const a = detail.app;
const sizes = (m: Record<string, unknown>) =>
  [['Pants', m.pants], ['Shirt', m.shirt_top], ['Underwear', m.underwear], ['Socks', m.socks], ['Diapers', m.diapers]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
---
<article class="slip">
  <div class="row">
    <span><strong>PU #:</strong> {a.pu_number ?? '____'}</span>
    <span><strong>People:</strong> {detail.members.length}</span>
  </div>
  <p class="name"><strong>{a.first_name} {a.last_name}</strong> — {a.phone}</p>
  <p>{a.address}, {detail.city_name}</p>
  {detail.pickup_day && (
    <p class="pickup"><strong>Pickup:</strong> {detail.pickup_day.date_text}{detail.pickup_day.description ? ` — ${detail.pickup_day.description}` : ''}</p>
  )}
  <p>
    {a.diabetic === 1 && <span class="flag">DIABETIC</span>}
    {a.bed_choice !== 'none' && <span>Bed: {a.bed_choice}{a.bed_size ? ` (${a.bed_size})` : ''}</span>}
  </p>
  <table>
    <caption class="sr-only">Household members and sizes</caption>
    <thead><tr><th scope="col">Name</th><th scope="col">Sex</th><th scope="col">Age</th><th scope="col">Sizes</th></tr></thead>
    <tbody>
      {detail.members.map((m) => (
        <tr><td>{m.name}</td><td>{m.sex}</td><td>{m.age}</td><td>{sizes(m)}</td></tr>
      ))}
    </tbody>
  </table>
</article>
<style>
  /* Sherlyn's layout from the old site: large slips, three per printed page.
     min-height (not height) so a big household grows taller instead of
     clipping people off the slip. */
  .slip { border: 2px solid #000; padding: 14px; margin: 0 0 12px; font-size: 16px; min-height: 3.1in; break-inside: avoid; box-sizing: border-box; }
  .row { display: flex; gap: 24px; font-size: 20px; }
  .name { font-size: 22px; margin: 8px 0 2px; }
  .pickup { font-size: 18px; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 16px; }
  th, td { border: 1px solid #666; padding: 4px 6px; text-align: left; }
  .flag { font-weight: bold; color: #b91c1c; margin-right: 8px; }
  /* This component's pages (slips.astro, [id]/slip.astro) intentionally
     don't import global.css, so Tailwind's sr-only utility isn't loaded
     here — define the same visually-hidden technique locally. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
```

(Note: the `@media print { page-break-after: always }` rule is GONE — that is what allows 3 per page.)

- [ ] **Step 3: Rename labels**

1. `slips.astro` — `<title>Packing slips {season}</title>`; button text `Print all {slips.length} packing slips`; `<h1 ...>Approved packing slips — {viewLabel} — {season} ({slips.length})</h1>`.
2. `[id]/slip.astro` — `<title>` both branches `Packing slip — ...` / `Packing slip`; `<h1 ...>Packing slip</h1>`; mailed text: `Mailed household — no packing slip. They receive gift and food cards by mail.`
3. `[id].astro:235` — button text `Print packing slip`.
4. `index.astro:154` — button text `Print packing slips`.

- [ ] **Step 4: Adjust `tests/db-admin-slips.test.ts` if needed**

`listApprovedForSlips` is unchanged; only fix assertions (if any) that expect gifts/bags to RENDER — data-layer assertions on members stay valid.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/slip-privacy.test.ts tests/db-admin-slips.test.ts` (PASS), `npm run test`, `npm run build`.

```bash
git add -A
git commit -m "feat(slips): packing slips for volunteers — no bags/gifts/sponsor, 3 large per page, privacy pinned by test"
```

---

### Task 4: Per-child doll choice

**Files:**
- Modify: `src/lib/validation/application.ts` (MemberClean + validateMembers), `src/lib/validation/application-admin.ts` (member loop), `src/lib/db.ts` (MemberEdit, insertApplication members, insertMember, updateMember), `src/components/apply/MemberCard.astro`, `src/pages/admin/applications/[id]/members.astro`, `src/pages/admin/applications/[id].astro` (People table)
- Test: `tests/application-validation-household.test.ts` (add cases), `tests/db-members.test.ts` or `tests/db-application.test.ts` (round-trip)

**Interfaces:**
- Consumes: `household_members.doll` column (Task 1's migration 0010).
- Produces: `MemberClean.doll?: '' | 'black' | 'white'`; `MemberEdit.doll?: string`; form field name `member_doll_{i}`; editor field name `doll`. Task 6 reads `m.doll` in export SQL.

- [ ] **Step 1: Write failing validation tests**

In `tests/application-validation-household.test.ts` (inside/beside the member describe blocks; mirror the file's existing input-building helpers):

```ts
describe('doll choice', () => {
  it('accepts black and white and defaults blank', () => {
    const input = baseMemberInput(); // the file's existing helper/fixture for a valid single-member form
    input['member_doll_1'] = 'black';
    const errors: Record<string, string> = {};
    const members = validateMembers(input, errors)!;
    expect(members[0].doll).toBe('black');
    expect(errors).toEqual({});
  });
  it('coerces junk to no-doll instead of erroring the applicant', () => {
    const input = baseMemberInput();
    input['member_doll_1'] = 'purple';
    const errors: Record<string, string> = {};
    const members = validateMembers(input, errors)!;
    expect(members[0].doll).toBe('');
    expect(errors).toEqual({}); // a tampered select must never block a family
  });
});
```

(Adapt `baseMemberInput()` to whatever member-input helper the file actually uses — read the file first.)
Run: `npx vitest run tests/application-validation-household.test.ts` — expect FAIL (`doll` undefined).

- [ ] **Step 2: Implement validation**

`src/lib/validation/application.ts`:
- `MemberClean` gains `doll?: '' | 'black' | 'white';` (after `partTime`).
- In `validateMembers`, after `const gifts = ...`:

```ts
    const dollRaw = get(input, `member_doll_${i}`);
    // A <select> can only be wrong if tampered with — coerce, never error.
    const doll = (dollRaw === 'black' || dollRaw === 'white' ? dollRaw : '') as '' | 'black' | 'white';
```

- Add `doll !== ''` awareness to `allBlank` (a row with only a doll chosen is not blank): change the condition to also require `dollRaw === ''`.
- Add `doll,` to the `members.push({...})` object.

`src/lib/validation/application-admin.ts` (member loop): same three changes — parse `member_doll_${i}` with the same coercion, include `dollRaw === ''` in `contentBlank`, push `doll`.

Run the tests from Step 1: PASS.

- [ ] **Step 3: Write failing DB round-trip test**

In `tests/db-members.test.ts` add (mirroring the file's fixtures):

```ts
it('persists the doll choice through insert and update', async () => {
  const id = await insertMember(db, appId, { ...memberFixture, doll: 'black' });
  let row = await db.prepare('SELECT doll FROM household_members WHERE id = ?').bind(id).first<{ doll: string }>();
  expect(row!.doll).toBe('black');
  await updateMember(db, id, appId, { ...memberFixture, doll: 'white' });
  row = await db.prepare('SELECT doll FROM household_members WHERE id = ?').bind(id).first<{ doll: string }>();
  expect(row!.doll).toBe('white');
});
```

Also in `tests/db-application.test.ts` (or the closest insert test): give one fixture member `doll: 'white'` and assert it comes back from `getApplicationDetail` members.
Run — expect FAIL.

- [ ] **Step 4: Implement DB layer**

`src/lib/db.ts`:
- `MemberEdit` gains `doll?: string;` (after `partTime?`).
- `insertApplication` member INSERT: add `doll` to the column list (after `part_time`), one `?`, and `m.doll ?? ''` to the bind (after `m.partTime ? 1 : 0`).
- `insertMember`: same three additions.
- `updateMember`: add `doll = ?` to SET (after `part_time = ?`) and `m.doll ?? ''` to bind.

Run Step 3 tests: PASS.

- [ ] **Step 5: Applicant form + admin editor + detail display**

1. `src/components/apply/MemberCard.astro` — after the gifts `<div>` (the one containing `member_gifts_${i}`), add:

```astro
  <div class="mt-4">
    <label for={`member_doll_${i}`} class="block font-semibold">Would they like a doll?</label>
    <select id={`member_doll_${i}`} name={`member_doll_${i}`} class={input}>
      <option value="" selected={v(`member_doll_${i}`) === ''}>No doll</option>
      <option value="black" selected={v(`member_doll_${i}`) === 'black'}>Black doll</option>
      <option value="white" selected={v(`member_doll_${i}`) === 'white'}>White doll</option>
    </select>
  </div>
```

(No JS needed; the `#member-template` in `apply.astro` clones this automatically.)
2. `src/pages/admin/applications/[id]/members.astro` — in the POST parse (~line 32-35) add `doll: g('doll'),` to the member object; in BOTH row templates (edit row after the Gifts label ~109, add row after ~148) add:

```astro
              <label class="block font-semibold">Doll
                <select class={input} name="doll">
                  <option value="" selected={(m?.doll ?? '') === ''}>No doll</option>
                  <option value="black" selected={m?.doll === 'black'}>Black doll</option>
                  <option value="white" selected={m?.doll === 'white'}>White doll</option>
                </select>
              </label>
```

(In the blank add-row, drop the `selected` bindings — plain options.)
3. `src/pages/admin/applications/[id].astro` People table (~156): add `<th scope="col" class="border-b p-2">Doll</th>` after `Gifts wanted`, and in the row (~172) add `<td class="border-b p-2">{m.doll === 'black' ? 'Black doll' : m.doll === 'white' ? 'White doll' : '—'}</td>`.

- [ ] **Step 6: Verify and commit**

Run: `npm run test`, `npx tsc --noEmit`, `npm run build` — green.

```bash
git add -A
git commit -m "feat(apply+admin): per-child black/white doll choice — form dropdown, editor, detail display"
```

---

### Task 5: Cards-given + Thanksgiving tracking

**Files:**
- Modify: `src/lib/db.ts`, `src/pages/admin/applications/[id].astro`, `src/pages/admin/applications/index.astro`
- Test: Create `tests/db-cards-given.test.ts`

**Interfaces:**
- Consumes: Task 1's five `applications` columns.
- Produces (in `src/lib/db.ts`):

```ts
export const THANKSGIVING_CARD_TOTAL = 30;
export type CardsGiven = {
  thanksgivingCard: boolean;
  foodCard: boolean; foodCardAmount: number | null;
  giftCard: boolean; giftCardAmount: number | null;
};
export async function setCardsGiven(db: D1Database, id: number, c: CardsGiven): Promise<void>;
export async function thanksgivingCount(db: D1Database, seasonYear: number): Promise<number>;
```

Task 6 reads the raw columns via `ExportRow`.

- [ ] **Step 1: Write failing DB tests**

Create `tests/db-cards-given.test.ts` (mirror `tests/db-admin-actions.test.ts` for harness usage and a `base` NewApplication fixture — WITHOUT `mayNotBeEligible`, removed in Task 1):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, setCardsGiven, thanksgivingCount, softDeleteApplication, type NewApplication } from '../src/lib/db';

describe('cards given + thanksgiving count', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('round-trips the five fields', async () => {
    const id = await insertApplication(db, base); // base: copy the fixture shape from db-admin-actions.test.ts
    await setCardsGiven(db, id, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: false, giftCardAmount: null });
    const row = await db.prepare('SELECT thanksgiving_card, food_card, food_card_amount, gift_card, gift_card_amount FROM applications WHERE id = ?').bind(id).first<Record<string, unknown>>();
    expect(row).toEqual({ thanksgiving_card: 1, food_card: 1, food_card_amount: 50, gift_card: 0, gift_card_amount: null });
  });

  it('counts thanksgiving cards per season, ignoring deleted', async () => {
    const a = await insertApplication(db, base);
    const b = await insertApplication(db, base);
    const other = await insertApplication(db, { ...base, seasonYear: 2025 });
    for (const id of [a, b, other]) await setCardsGiven(db, id, { thanksgivingCard: true, foodCard: false, foodCardAmount: null, giftCard: false, giftCardAmount: null });
    expect(await thanksgivingCount(db, 2026)).toBe(2);
    await softDeleteApplication(db, b, '2026-10-02T00:00:00Z');
    expect(await thanksgivingCount(db, 2026)).toBe(1);
  });
});
```

Run: `npx vitest run tests/db-cards-given.test.ts` — expect FAIL (functions not defined).

- [ ] **Step 2: Implement in `src/lib/db.ts`** (place near `setBagsCount`/`setApplicationNotes`):

```ts
// Sherlyn hands a Thanksgiving card to the first 30 applicants each season
// and tracks food/gift cards per household (mostly the mailed ones). She
// records them here herself — the site never marks anything automatically.
export const THANKSGIVING_CARD_TOTAL = 30;

export type CardsGiven = {
  thanksgivingCard: boolean;
  foodCard: boolean; foodCardAmount: number | null;
  giftCard: boolean; giftCardAmount: number | null;
};

export async function setCardsGiven(db: D1Database, id: number, c: CardsGiven): Promise<void> {
  await db
    .prepare(
      `UPDATE applications SET thanksgiving_card = ?, food_card = ?, food_card_amount = ?, gift_card = ?, gift_card_amount = ? WHERE id = ?`,
    )
    .bind(c.thanksgivingCard ? 1 : 0, c.foodCard ? 1 : 0, c.foodCardAmount, c.giftCard ? 1 : 0, c.giftCardAmount, id)
    .run();
}

export async function thanksgivingCount(db: D1Database, seasonYear: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM applications WHERE deleted_at IS NULL AND season_year = ? AND thanksgiving_card = 1')
    .bind(seasonYear)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
```

Run Step 1 tests: PASS.

- [ ] **Step 3: Detail-page "Cards given" form**

`src/pages/admin/applications/[id].astro`:
1. Import `setCardsGiven` (add to the existing db import list) and `parseMoney` from `../../../lib/validation/application`.
2. New POST branch after `set_notes` (~line 51):

```ts
    } else if (act === 'set_cards') {
      const money = (name: string) => { const raw = String(form.get(name) ?? '').trim(); return raw === '' ? null : parseMoney(raw); };
      await setCardsGiven(env.DB, id, {
        thanksgivingCard: String(form.get('thanksgiving_card') ?? '') === 'on',
        foodCard: String(form.get('food_card') ?? '') === 'on',
        foodCardAmount: money('food_card_amount'),
        giftCard: String(form.get('gift_card') ?? '') === 'on',
        giftCardAmount: money('gift_card_amount'),
      });
      return Astro.redirect(`${detailUrl}?done=cards`, 303);
```

3. Banner (~line 83): add `: done === 'cards' ? 'Cards saved.'` alongside the other `done` cases.
4. New section directly AFTER the "Your notes" form block (~line 300), same visual pattern:

```astro
      <section class="mt-8 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Cards given</h2>
        <p class="mt-1 text-stone-600">Only you see this — use it to track what this household was given.</p>
        <form method="post" class="mt-3 space-y-3">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <label class="flex items-center gap-3"><input type="checkbox" name="thanksgiving_card" checked={a.thanksgiving_card === 1} class="h-6 w-6" /> Thanksgiving card given</label>
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-3"><input type="checkbox" name="food_card" checked={a.food_card === 1} class="h-6 w-6" /> Food card or certificate given</label>
            <label class="flex items-center gap-2">Amount $
              <input type="text" inputmode="decimal" name="food_card_amount" value={a.food_card_amount ?? ''} class="w-28 rounded border-2 border-stone-400 p-2" />
            </label>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-3"><input type="checkbox" name="gift_card" checked={a.gift_card === 1} class="h-6 w-6" /> Gift cards given</label>
            <label class="flex items-center gap-2">Amount $
              <input type="text" inputmode="decimal" name="gift_card_amount" value={a.gift_card_amount ?? ''} class="w-28 rounded border-2 border-stone-400 p-2" />
            </label>
          </div>
          <button type="submit" name="act" value="set_cards" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save cards</button>
        </form>
      </section>
```

- [ ] **Step 4: List-page counter**

`src/pages/admin/applications/index.astro`:
1. Add `thanksgivingCount, THANKSGIVING_CARD_TOTAL` to the db import; compute `const tgCount = await thanksgivingCount(db, season);` beside the other queries.
2. Directly under the Help paragraph (line ~72) add:

```astro
  <p class="mt-2 text-lg font-semibold text-holly-800">Thanksgiving cards: {tgCount} of {THANKSGIVING_CARD_TOTAL} given.</p>
```

- [ ] **Step 5: Verify and commit**

Run: `npm run test`, `npx tsc --noEmit`, `npm run build` — green.

```bash
git add -A
git commit -m "feat(admin): Cards given tracking (Thanksgiving/food/gift cards + amounts) with a season counter"
```

---

### Task 6: Excel — Sherlyn's 11-column sheet + full backup export

**Files:**
- Create: `src/lib/export-columns.ts`, `tests/export-columns.test.ts`, `src/pages/admin/applications/export-full.xlsx.ts`
- Modify: `src/lib/db.ts` (`ExportRow` + `listApplicationsForExport`), `src/pages/admin/applications/export.xlsx.ts` (rewrite), `src/pages/admin/applications/index.astro` (second button), `tests/db-admin-export.test.ts`

**Interfaces:**
- Consumes: Task 1's slimmed `ExportRow`, Task 4's `m.doll`, Task 5's five columns.
- Produces:

```ts
// src/lib/export-columns.ts
export function sherlynHeaders(season: number): string[];           // her 11, verbatim
export function sherlynRow(r: ExportRow): (string | number | null)[];
export function fullHeaders(): string[];                            // backup export
export function fullRow(r: ExportRow): (string | number | null)[];
```

`ExportRow` gains: `thanksgiving_card: number; food_card: number; food_card_amount: number | null; gift_card: number; gift_card_amount: number | null; dolls_summary: string;` and `member_summary` gains doll markers.

- [ ] **Step 1: Extend the export query (failing test first)**

In `tests/db-admin-export.test.ts` add:

```ts
it('exports dolls and card-tracking fields', async () => {
  const { db, dispose } = await getTestDb();
  try {
    const id = await insertApplication(db, {
      ...base, lastName: 'Dolls',
      members: [
        { name: 'Mom Dolls', relationship: 'self', sex: 'F', age: 30, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
        { name: 'Sue Dolls', relationship: 'daughter', sex: 'F', age: 5, doll: 'black', pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'blocks' },
      ],
    });
    await setCardsGiven(db, id, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: true, giftCardAmount: 25 });
    const r = (await listApplicationsForExport(db, 2026, 'all', '')).find((x) => x.last_name === 'Dolls')!;
    expect(r.dolls_summary).toBe('Black doll (Sue Dolls)');
    expect(r.member_summary).toContain('black doll');
    expect(r.thanksgiving_card).toBe(1);
    expect(r.food_card_amount).toBe(50);
    expect(r.gift_card_amount).toBe(25);
  } finally { await dispose(); }
});
```

(Add `setCardsGiven` to the imports; `doll` on a fixture member requires Task 4's `MemberEdit`/`NewApplication` member shape — it is optional, so other fixtures are untouched.)
Run — expect FAIL.

- [ ] **Step 2: Implement in `listApplicationsForExport`**

1. SELECT adds: `a.thanksgiving_card, a.food_card, a.food_card_amount, a.gift_card, a.gift_card_amount,`.
2. Inside `member_summary`'s GROUP_CONCAT, after the `part_time` CASE add:

```sql
             CASE WHEN m.doll = 'black' THEN ', black doll' WHEN m.doll = 'white' THEN ', white doll' ELSE '' END ||
```

3. After the `gifts_summary` line add:

```sql
           COALESCE(GROUP_CONCAT(CASE m.doll WHEN 'black' THEN 'Black doll (' || m.name || ')' WHEN 'white' THEN 'White doll (' || m.name || ')' END, '; '), '') AS dolls_summary,
```

4. `ExportRow` gains the six fields listed in Interfaces.
Run Step 1 test: PASS.

- [ ] **Step 3: Write the pure column lib (failing test first)**

Create `tests/export-columns.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sherlynHeaders, sherlynRow, fullHeaders, fullRow } from '../src/lib/export-columns';
import type { ExportRow } from '../src/lib/db';

const row: ExportRow = {
  pu_number: 803, status: 'approved', submitted_at: '2026-10-01T12:00:00Z', decided_at: null,
  first_name: 'Jane', last_name: 'Smith', address: '123 Oak St', city_name: 'Lancaster',
  phone: '608', email: 'a@b.co', household_type: 'family', bags_count: null,
  parentage_note: '', admin_notes: '', years_received_help: 2, adopted_last_year: 1,
  bed_choice: 'none', bed_size: null, food_share_amount: null, social_security_amount: null,
  ssi_amount: null, child_support_amount: null, unemployment_weekly_amount: null, other_income_amount: null,
  member_count: 3, member_summary: 'Jane Smith (self, age 30)', gifts_summary: 'Tim Smith: bike',
  dolls_summary: 'Black doll (Sue Smith)', employment_summary: '',
  thanksgiving_card: 1, food_card: 1, food_card_amount: 50, gift_card: 0, gift_card_amount: null,
  source: 'online',
};

describe('sherlyn sheet', () => {
  it('pins her 11 headers verbatim', () => {
    expect(sherlynHeaders(2026)).toEqual([
      'tNo', '2026 Applicant', 'Address', 'Special Gift', 'adopted', 'Thanksgiving',
      'Food Card/Cert.', 'Amount', 'Gift Cards', 'GC Amount', 'NO. in HH',
    ]);
  });
  it('maps a row: dolls fold into Special Gift, yes/blank flags, blank null amounts', () => {
    expect(sherlynRow(row)).toEqual([
      803, 'Jane Smith', '123 Oak St, Lancaster', 'Black doll (Sue Smith); Tim Smith: bike',
      'yes', 'yes', 'yes', 50, '', '', 3,
    ]);
  });
});

describe('full backup export', () => {
  it('has no eligibility columns and carries the new fields', () => {
    const h = fullHeaders();
    expect(h).not.toContain('Check eligibility');
    expect(h).not.toContain('Income check');
    for (const col of ['Thanksgiving', 'Food card', 'Food card amount', 'Gift cards', 'Gift card amount', 'Dolls']) {
      expect(h).toContain(col);
    }
    expect(fullRow(row)).toHaveLength(h.length);
  });
});
```

Run — FAIL (module missing).

- [ ] **Step 4: Implement `src/lib/export-columns.ts`**

```ts
// The two Excel downloads, as pure header/row mappers so the routes stay
// thin and the exact columns are pinned by tests/export-columns.test.ts.
// The primary sheet is EXACTLY the working spreadsheet Sherlyn keeps by
// hand (her column titles, verbatim); the full export is the everything-
// backup used before purging a season and for the next maintainer.
import type { ExportRow } from './db';
import { centralDateTime } from './dates';

const yes = (v: number) => (v === 1 ? 'yes' : '');

export function sherlynHeaders(season: number): string[] {
  return [
    'tNo', `${season} Applicant`, 'Address', 'Special Gift', 'adopted', 'Thanksgiving',
    'Food Card/Cert.', 'Amount', 'Gift Cards', 'GC Amount', 'NO. in HH',
  ];
}

export function sherlynRow(r: ExportRow): (string | number | null)[] {
  const specialGift = [r.dolls_summary, r.gifts_summary].filter(Boolean).join('; ');
  return [
    r.pu_number, `${r.first_name} ${r.last_name}`, `${r.address}, ${r.city_name}`, specialGift,
    yes(r.adopted_last_year), yes(r.thanksgiving_card),
    yes(r.food_card), r.food_card_amount ?? '', yes(r.gift_card), r.gift_card_amount ?? '',
    r.member_count,
  ];
}

export function fullHeaders(): string[] {
  return [
    'Pickup #', 'Status', 'Decided', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type', 'Bags',
    'People count', 'People', 'Gifts requested', 'Dolls', 'Years received', 'Adopted last year',
    'Bed', 'Bed size', 'Income', 'Jobs',
    'Thanksgiving', 'Food card', 'Food card amount', 'Gift cards', 'Gift card amount',
    'Parentage note', 'Your notes', 'Source',
  ];
}

export function fullRow(r: ExportRow): (string | number | null)[] {
  const income = [
    ['Food Share', r.food_share_amount], ['Social Security', r.social_security_amount], ['SSI', r.ssi_amount],
    ['Child support', r.child_support_amount], ['Unemployment', r.unemployment_weekly_amount], ['Other', r.other_income_amount],
  ].filter(([, v]) => v != null).map(([k, v]) => `${k} $${v}`).join('; ');
  return [
    r.pu_number, r.status, centralDateTime(r.decided_at ?? ''), centralDateTime(r.submitted_at),
    r.first_name, r.last_name, r.address, r.city_name, r.phone, r.email, r.household_type, r.bags_count,
    r.member_count, r.member_summary, r.gifts_summary, r.dolls_summary, r.years_received_help,
    yes(r.adopted_last_year), r.bed_choice, r.bed_size ?? '', income, r.employment_summary,
    yes(r.thanksgiving_card), yes(r.food_card), r.food_card_amount ?? '', yes(r.gift_card), r.gift_card_amount ?? '',
    r.parentage_note, r.admin_notes, r.source,
  ];
}
```

Run Step 3 tests: PASS.

- [ ] **Step 5: Rewrite the routes**

`src/pages/admin/applications/export.xlsx.ts` — replace the header/row/incomeSummary logic with the lib:

```ts
import type { APIRoute } from 'astro';
import { listApplicationsForExport, latestSeason } from '../../../lib/db';
import { buildXlsx } from '../../../lib/xlsx';
import { sherlynHeaders, sherlynRow } from '../../../lib/export-columns';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const season = Number(url.searchParams.get('season')) || (await latestSeason(locals.runtime.env.DB)) || new Date().getFullYear();
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = (['all', 'new', 'approved', 'denied'].includes(statusParam) ? statusParam : 'all') as
    'all' | 'new' | 'approved' | 'denied';
  const search = url.searchParams.get('q') ?? '';
  const townRaw = url.searchParams.get('town') ?? '';
  const town = townRaw === 'mailed' ? ('mailed' as const) : townRaw === 'stragglers' ? ('stragglers' as const) : /^\d+$/.test(townRaw) && Number(townRaw) > 0 ? Number(townRaw) : null;
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status, search, town);
  const workbook = buildXlsx('Applications', sherlynHeaders(season), rows.map(sherlynRow));
  // Uint8Array is a valid BodyInit at runtime; cast past the workers-types BodyInit union.
  return new Response(workbook as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="applications-${season}-${status}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
};
```

Create `src/pages/admin/applications/export-full.xlsx.ts` — identical shape but using `fullHeaders()` / `fullRow` and `filename="applications-full-${season}-${status}.xlsx"`.

- [ ] **Step 6: Second button on the list page**

`src/pages/admin/applications/index.astro` — beside the existing Download link (~152), reusing `exportHref`'s query string:

```astro
    <a href={exportHref.replace('/export.xlsx', '/export-full.xlsx')} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">Download everything (backup)</a>
```

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run tests/export-columns.test.ts tests/db-admin-export.test.ts` (PASS), `npm run test`, `npx tsc --noEmit`, `npm run build` — green.

```bash
git add -A
git commit -m "feat(export): Sherlyn's 11-column sheet is THE download; full backup export beside it; dolls fold into Special Gift"
```

---

### Task 7: Runbook — this batch's deploy order

**Files:**
- Modify: `docs/go-live-runbook.md` ("Shipping a code update after go-live" section)

**Interfaces:** none (docs only).

- [ ] **Step 1: Add the batch-specific ordering note**

In `docs/go-live-runbook.md`, inside the "Shipping a code update after go-live" section, add after the step-3 migration bullet:

```markdown
- [ ] **Season-revisions batch (July 2026) — read before deploying it.** Three
      migrations are pending together: `0009` (soft-delete columns), `0010`
      (doll + card-tracking columns), and `0011` (**drops** the old
      `income_limits` table). Because `0011` removes a table the OLD code
      still reads, run the migrate and the deploy **back-to-back in one
      sitting**:
      1. `npm run db:migrate:remote`  (applies 0009 + 0010 + 0011)
      2. `npm run build` then `npx wrangler pages deploy dist --project-name gchp-site`
      **Between step 1 and step 2 the admin applications screens will show
      errors — that is expected and lasts only until the deploy finishes.
      Do not stop halfway.** The public site is unaffected (applications are
      closed; nothing public reads the dropped table).
```

- [ ] **Step 2: Commit**

```bash
git add docs/go-live-runbook.md
git commit -m "docs(runbook): season-revisions batch — migrate 0009-0011 and deploy back-to-back; expect a brief admin error window"
```

---

## After all tasks (controller/owner, not code)

- Final whole-branch review, then: the operator guide (🎄 artifact) and succession manual (📖 artifact) need updating — packing-slip rename, Cards given box, Thanksgiving counter, two-button Excel download, income-check/box-cards removal. The controller does this with the Artifact tool; it is not a subagent task.
- The four outstanding "confirm with Sherlyn" income-check items (memory `income-check-feature`) are MOOT — the feature is removed.
- Deploy is held per the owner's standing decision (~Oct 1); when it happens, follow the new runbook note (migrate 0009–0011 + deploy back-to-back).

## Self-review notes (checked against the spec)

- Spec §1 removals → Tasks 1–2 (income questions + nudge stay: untouched by any task). §2 packing slips → Task 3. §3 dolls → Task 4. §4 tracking → Task 5. §5 exports → Task 6. §6 migrations/order → Tasks 1 + 7. §7 testing → embedded per task (scan tests in Tasks 1–3, TDD in 4–6). §8 docs → Task 7 + After-all-tasks.
- `may_not_be_eligible` column: kept inert by design (spec Part 1), asserted present in Task 1 Step 3.
- Type coherence: `MemberClean.doll`/`MemberEdit.doll` optional everywhere; `ExportRow` field list in Task 6 matches Task 1's removals plus Task 6's additions; `sherlynRow` consumes only `ExportRow` fields that exist after those edits.
