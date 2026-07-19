# Submission & Decision Times — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record when each application is approved or denied (`decided_at`), show applied/decided date-times in Central time on the admin detail page and Excel export, and fix the existing UTC day-shift display bug in the list, export, and Messages page.

**Architecture:** Migration `0006` adds nullable `applications.decided_at`, set by `setApplicationStatus`; a tiny pure `src/lib/dates.ts` (America/Chicago formatting) replaces every raw `iso.slice(0, 10)`; the export gains a "Decided" column.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Cloudflare D1, Vitest. Tests `npm test`; build `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-18-decision-times-design.md`.

## Global Constraints

- Storage stays UTC ISO strings; ONLY display converts, always via `timeZone: 'America/Chicago'` (never the server's local zone — Workers run UTC).
- `decided_at` is nullable; rows decided before this feature display nothing. No backfill.
- Formatters return `''` for empty/invalid input.
- Formats exactly: `centralDate` → `12/03/2026`; `centralDateTime` → `12/03/2026, 8:30 PM`.
- Export header/row arrays must stay aligned column-for-column ("Decided" inserted immediately after "Status" in BOTH).
- No applicant-facing change; no workflow/status change. Admin copy plain English; straight apostrophes.

---

## Task 1: Migration 0006, dates lib, decided_at write path

**Files:**
- Create: `migrations/0006_decided_at.sql`
- Modify: `tests/helpers/d1.ts:11` (migration loop)
- Create: `src/lib/dates.ts`
- Create: `tests/dates.test.ts`
- Modify: `src/lib/db.ts` — `setApplicationStatus` (~:270-276)
- Create: `tests/db-decided-at.test.ts`
- Modify: `tests/d1-schema.test.ts` (one case)

**Interfaces:**
- Produces: `applications.decided_at TEXT` (nullable); `centralDate(iso: string): string` and `centralDateTime(iso: string): string` from `src/lib/dates.ts`; `setApplicationStatus` now stamps `decided_at`.

- [ ] **Step 1: Migration + harness**

Create `migrations/0006_decided_at.sql`:

```sql
-- Decision timestamps (2026-07-18 spec): when the operator approves or denies.
-- Nullable: rows decided before this feature show nothing. Run ONCE against
-- the live DB with `npm run db:migrate:remote`; tests apply it via
-- tests/helpers/d1.ts.
ALTER TABLE applications ADD COLUMN decided_at TEXT;
```

In `tests/helpers/d1.ts` line 11, append `'migrations/0006_decided_at.sql'` to the file list.

- [ ] **Step 2: Failing formatter tests**

Create `tests/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { centralDate, centralDateTime } from '../src/lib/dates';

describe('central-time formatting', () => {
  it('a UTC evening lands on the previous Central day (CST, UTC-6)', () => {
    expect(centralDate('2026-12-04T02:30:00Z')).toBe('12/03/2026');
    expect(centralDateTime('2026-12-04T02:30:00Z')).toBe('12/03/2026, 8:30 PM');
  });
  it('summer uses CDT (UTC-5)', () => {
    expect(centralDateTime('2026-07-10T03:30:00Z')).toBe('07/09/2026, 10:30 PM');
  });
  it('midday stays on the same day', () => {
    expect(centralDateTime('2026-12-03T18:00:00Z')).toBe('12/03/2026, 12:00 PM');
  });
  it('empty and invalid input yield empty strings', () => {
    expect(centralDate('')).toBe('');
    expect(centralDateTime('')).toBe('');
    expect(centralDate('not-a-date')).toBe('');
    expect(centralDateTime('not-a-date')).toBe('');
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/dates.test.ts`
Expected: FAIL — cannot resolve `../src/lib/dates`.

- [ ] **Step 4: Implement the lib**

Create `src/lib/dates.ts`:

```ts
// Display formatting for Grant County (America/Chicago). Timestamps are
// STORED as UTC ISO strings everywhere; only display converts. Never format
// with the server's local zone — Workers run in UTC, which is exactly the
// day-shift bug this module fixes.
const CENTRAL = 'America/Chicago';

export function centralDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { timeZone: CENTRAL, month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function centralDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: CENTRAL, month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
```

- [ ] **Step 5: Run the formatter tests**

Run: `npx vitest run tests/dates.test.ts`
Expected: PASS (4 tests). If the `centralDateTime` assertions fail on the exact separator (some ICU builds emit a narrow no-break space before AM/PM), normalize in the lib — replace ` ` with a regular space via `.replace(/ /g, ' ')` on the result — so the operator-visible string is a plain space; update nothing in the tests.

- [ ] **Step 6: Failing decided_at tests**

Create `tests/db-decided-at.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, setApplicationStatus, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('decided_at', () => {
  it('is NULL on insert, stamped on approve and on deny', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      const before = await db.prepare('SELECT decided_at FROM applications WHERE id = ?').bind(a).first<{ decided_at: string | null }>();
      expect(before?.decided_at).toBeNull();
      await setApplicationStatus(db, a, 'approved');
      await setApplicationStatus(db, b, 'denied');
      const appr = await db.prepare('SELECT decided_at FROM applications WHERE id = ?').bind(a).first<{ decided_at: string | null }>();
      const den = await db.prepare('SELECT decided_at FROM applications WHERE id = ?').bind(b).first<{ decided_at: string | null }>();
      expect(appr?.decided_at).toBeTruthy();
      expect(den?.decided_at).toBeTruthy();
      expect(Number.isNaN(new Date(appr!.decided_at!).getTime())).toBe(false);
    } finally { await dispose(); }
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run tests/db-decided-at.test.ts`
Expected: FAIL — `decided_at` stays NULL after approve.

- [ ] **Step 8: Implement the write path**

In `src/lib/db.ts`, change `setApplicationStatus`'s UPDATE:

```ts
export async function setApplicationStatus(
  db: D1Database,
  id: number,
  status: 'approved' | 'denied',
): Promise<void> {
  await db
    .prepare('UPDATE applications SET status = ?, decided_at = ? WHERE id = ?')
    .bind(status, new Date().toISOString(), id)
    .run();
}
```

- [ ] **Step 9: Schema case + all green**

In `tests/d1-schema.test.ts`, add:

```ts
it('0006 adds applications.decided_at', async () => {
  const cols = await db.prepare("SELECT name FROM pragma_table_info('applications')").all<{ name: string }>();
  expect(cols.results.map((c) => c.name)).toContain('decided_at');
});
```

Run: `npx vitest run tests/db-decided-at.test.ts tests/d1-schema.test.ts`, then `npm test`, then `npx tsc --noEmit`
Expected: all pass, tsc exit 0.

- [ ] **Step 10: Commit**

```bash
git add migrations/0006_decided_at.sql tests/helpers/d1.ts src/lib/dates.ts tests/dates.test.ts src/lib/db.ts tests/db-decided-at.test.ts tests/d1-schema.test.ts
git commit -m "feat(db): decided_at stamped on approve/deny + Central-time formatters"
```

---

## Task 2: Surface the times — detail, list, export, messages

**Files:**
- Modify: `src/lib/db.ts` — `ExportRow` + the export SELECT (add `a.decided_at`)
- Modify: `src/pages/admin/applications/[id].astro` (Household + Decision sections)
- Modify: `src/pages/admin/applications/index.astro` (`fmtDate` at :59, call site :172)
- Modify: `src/pages/admin/applications/export.xlsx.ts` (headers + row mapping)
- Modify: `src/pages/admin/messages/index.astro` (`fmtDate` at :43, call site :56)
- Modify: `tests/db-admin-export.test.ts` (one assertion)

**Interfaces:**
- Consumes: `centralDate`/`centralDateTime` (Task 1), `decided_at` column (Task 1).
- Produces: `ExportRow` gains `decided_at: string | null`.

- [ ] **Step 1: Export data — failing assertion first**

In `tests/db-admin-export.test.ts`, inside the existing `"runs a specific-status branch"` case (its fixture approves an application), add after the existing expectations:

```ts
    expect(approved.find((r) => r.first_name === 'Approved')?.decided_at).toBeTruthy();
```

Run: `npx vitest run tests/db-admin-export.test.ts` — expected FAIL (`decided_at` undefined on ExportRow).

In `src/lib/db.ts`: add `decided_at: string | null;` to `ExportRow`, and add `a.decided_at,` to the export SELECT column list (next to `a.submitted_at`). Re-run: PASS.

- [ ] **Step 2: Export route — the Decided column**

In `src/pages/admin/applications/export.xlsx.ts`:

```ts
import { centralDateTime } from '../../../lib/dates';
```

In `headers`, insert `'Decided'` immediately after `'Status'`. In the row mapping, the leading cells become:

```ts
    r.pu_number, r.status, centralDateTime(r.decided_at ?? ''), centralDateTime(r.submitted_at), r.first_name, r.last_name, r.address,
```

(This replaces `r.submitted_at.slice(0, 10)` — "Applied" now carries date + time in Central. Count both arrays after editing: they must remain aligned, "Decided" at the same index in each.)

- [ ] **Step 3: List + Messages — the day-shift fix**

`src/pages/admin/applications/index.astro`: delete the local helper at line 59 (`const fmtDate = (iso: string) => iso.slice(0, 10);`), add `import { centralDate } from '../../../lib/dates';` with the other imports, and change the call site (line ~172) to `{centralDate(r.submitted_at)}`.

`src/pages/admin/messages/index.astro`: same change — delete its local `fmtDate` (line 43), import `centralDate` (path `'../../../lib/dates'`), change the call site (line ~56) to `{centralDate(m.received_at)}`.

- [ ] **Step 4: Detail page**

In `src/pages/admin/applications/[id].astro`: add `import { centralDateTime } from '../../../lib/dates';` to the frontmatter imports.

In the Household section, directly after `<h2 class="text-2xl font-bold text-holly-800">Household</h2>`, add:

```astro
        <p class="mt-2 text-stone-700">Applied: {centralDateTime(String(a.submitted_at ?? ''))}</p>
```

In the Decision section, directly after the helper paragraph ("Approving assigns the next pickup number from this household's block…"), add:

```astro
        {a.status !== 'new' && a.decided_at && (
          <p class="mt-2 text-lg font-semibold">
            {a.status === 'approved' ? 'Approved' : 'Denied'} on {centralDateTime(String(a.decided_at))}
          </p>
        )}
```

- [ ] **Step 5: Verify everything**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`
Expected: all pass, tsc exit 0, build completes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts "src/pages/admin/applications/[id].astro" src/pages/admin/applications/index.astro src/pages/admin/applications/export.xlsx.ts src/pages/admin/messages/index.astro tests/db-admin-export.test.ts
git commit -m "feat(admin): applied/decided times in Central on detail + export; fix UTC day-shift in list and messages"
```

---

## After all tasks (not code)

- Ships with the held batch: `npm run db:migrate:remote` applies 0004+0005+0006 (all additive) before deploying.
- Applications approved/denied before this deploy show no decided time — expected, tell Sherlyn it starts counting from the update.
