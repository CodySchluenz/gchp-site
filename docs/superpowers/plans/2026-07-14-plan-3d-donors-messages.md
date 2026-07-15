# Plan 3d — Donors, Donations & Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two admin surfaces — a donor directory with donation tracking (donor-centric) and a contact-messages inbox — completing the admin console.

**Architecture:** Reuse the Plan 3b/3c editor pattern: per-row `<form>` + a separate "Add" form + server round-trips that redirect (Post/Redirect/Get) with a banner flag, no JavaScript, CSP-safe, `data-confirm` for destructive actions, CSRF verified first. Donors and donations soft-delete with undo (both tables have `deleted_at`); contact messages hard-delete with a confirm. New D1 helpers do donation ops scoped by `donor_id`.

**Tech Stack:** Astro 5 (server output, `@astrojs/cloudflare`), Cloudflare D1 (SQLite), Tailwind 4, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-14-plan-3d-donors-messages-design.md`

## Global Constraints

- **CSP `script-src 'self'`.** No inline event handlers, no inline `<script>`. Confirms come from `data-confirm` + external `public/scripts/print-button.js` (load it with `<script src="/scripts/print-button.js" defer></script>` on pages with confirms).
- **Every mutating admin POST enforces CSRF** via `verifyCsrf(env.CSRF_SECRET, cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''))`; on failure redirect back with `?error=csrf` (never silently discard). Mint the token on GET with the standard 5-line cookie block.
- **Post/Redirect/Get:** every mutation returns a 303 redirect; a refresh must be a GET.
- **Operator usability:** admin base font ≥18px (the `Admin` layout body is `text-lg`; the shared `input` class carries `text-lg`); text-labeled buttons; plain English; one clear primary action; obvious Back; confirm before destructive actions.
- **Straight apostrophes only** (`'`) — in JS strings write `didn\'t` / `It\'s`.
- **Sensitive PII:** donor/message contact info is PII — never log it; never put it in a redirect query string (ids and fixed flags only); gated `/admin` routes only.
- **No schema change; no public-site change** (no touching the Donate page or PayPal).
- **No new dependencies.** Reuse `escapeLike` and `parseMoney` from `src/lib/validation/application.ts`/`src/lib/db.ts`.
- **Verify before done:** each task ends green on `npm run test`; the whole plan ends green on `npm run build` and `npx tsc --noEmit`. Baseline suite is **133 tests**.

## Existing schema (migration 0001 — do NOT change)
```
donors(id, name NOT NULL, contact_person '', address '', city '', state '', zip '', phone '', email '', deleted_at)
donations(id, donor_id NOT NULL REFERENCES donors(id), date NOT NULL, item_description '', amount REAL, deleted_at)
contact_messages(id, received_at NOT NULL, name '', email NOT NULL, message NOT NULL, read_at)
```
`escapeLike` is exported from `src/lib/db.ts` (Plan 3c). The pickup editor `src/pages/admin/pickup/index.astro` and its `[id]/restore.ts` are the reference pattern for the donors list + restore endpoint.

## File Structure
- `src/lib/db.ts` — append donor helpers (T1), donation helpers + summary (T2), message helpers (T3).
- `src/pages/admin/donors/index.astro` — donors list + search + add + year summary + soft-delete/undo (T4).
- `src/pages/admin/donors/[id]/restore.ts` — restore a donor (T4).
- `src/pages/admin/donors/[id].astro` — edit donor + donation history + add/remove donation + inline donation undo (T5).
- `src/pages/admin/messages/index.astro` — inbox: read/unread toggle + hard-delete-with-confirm + mailto reply (T6).
- `src/layouts/Admin.astro` — +2 nav sections (T7).
- `src/components/admin/AdminHome.astro` — +2 cards, Messages shows unread count (T7).
- Tests: `tests/db-donors.test.ts` (T1), `tests/db-donations.test.ts` (T2), `tests/db-messages.test.ts` (T3).

---

### Task 1: Donor db helpers

**Files:**
- Modify: `src/lib/db.ts` (append at end of file)
- Test: `tests/db-donors.test.ts`

**Interfaces:**
- Consumes: `getTestDb` from `tests/helpers/d1`; `escapeLike` (already in db.ts).
- Produces:
  - `type AdminDonor = { id: number; name: string; contact_person: string; address: string; city: string; state: string; zip: string; phone: string; email: string }`
  - `type DonorEdit = Omit<AdminDonor, 'id'>`
  - `listDonors(db, search: string): Promise<AdminDonor[]>` — non-deleted, name search via `escapeLike`, ordered by name.
  - `getDonor(db, id): Promise<AdminDonor | null>` — non-deleted.
  - `createDonor(db, f: DonorEdit): Promise<number>` — returns new id.
  - `updateDonor(db, id, f: DonorEdit): Promise<void>`
  - `softDeleteDonor(db, id, iso): Promise<void>` / `restoreDonor(db, id): Promise<void>`

- [ ] **Step 1: Write the failing test** — `tests/db-donors.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { listDonors, getDonor, createDonor, updateDonor, softDeleteDonor, restoreDonor, type DonorEdit } from '../src/lib/db';

const blank: DonorEdit = { name: '', contact_person: '', address: '', city: '', state: '', zip: '', phone: '', email: '' };
const donor = (name: string, over: Partial<DonorEdit> = {}): DonorEdit => ({ ...blank, name, ...over });

describe('donor admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates, lists (ordered by name), and gets a donor', async () => {
    const b = await createDonor(db, donor('Beta Co', { city: 'Platteville', phone: '555' }));
    await createDonor(db, donor('Alpha Inc'));
    const all = await listDonors(db, '');
    expect(all.map((d) => d.name)).toEqual(['Alpha Inc', 'Beta Co']);
    const got = await getDonor(db, b);
    expect([got!.name, got!.city, got!.phone]).toEqual(['Beta Co', 'Platteville', '555']);
  });

  it('search matches by name and treats % literally', async () => {
    const { db: db2, dispose: d2 } = await getTestDb();
    try {
      await createDonor(db2, donor('Acme'));
      await createDonor(db2, donor('50% Off Store'));
      expect((await listDonors(db2, 'acme')).map((d) => d.name)).toEqual(['Acme']);
      expect((await listDonors(db2, '%')).map((d) => d.name)).toEqual(['50% Off Store']);
    } finally { await d2(); }
  });

  it('updates a donor', async () => {
    const id = await createDonor(db, donor('Gamma'));
    await updateDonor(db, id, donor('Gamma LLC', { email: 'g@x.co' }));
    const got = await getDonor(db, id);
    expect([got!.name, got!.email]).toEqual(['Gamma LLC', 'g@x.co']);
  });

  it('soft-deletes (hidden from list and get) and restores', async () => {
    const id = await createDonor(db, donor('Temp'));
    await softDeleteDonor(db, id, '2026-11-01T00:00:00Z');
    expect((await listDonors(db, '')).some((d) => d.id === id)).toBe(false);
    expect(await getDonor(db, id)).toBe(null);
    await restoreDonor(db, id);
    expect(await getDonor(db, id)).not.toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-donors.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/db.ts`

```ts
export type AdminDonor = {
  id: number; name: string; contact_person: string; address: string;
  city: string; state: string; zip: string; phone: string; email: string;
};
export type DonorEdit = Omit<AdminDonor, 'id'>;

export async function listDonors(db: D1Database, search: string): Promise<AdminDonor[]> {
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const { results } = await db
    .prepare(
      `SELECT id, name, contact_person, address, city, state, zip, phone, email
       FROM donors
       WHERE deleted_at IS NULL AND (? = '%%' OR lower(name) LIKE ? ESCAPE '\\')
       ORDER BY name COLLATE NOCASE, id`,
    )
    .bind(like, like)
    .all<AdminDonor>();
  return results;
}

export async function getDonor(db: D1Database, id: number): Promise<AdminDonor | null> {
  return await db
    .prepare(
      `SELECT id, name, contact_person, address, city, state, zip, phone, email
       FROM donors WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<AdminDonor>();
}

export async function createDonor(db: D1Database, f: DonorEdit): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO donors (name, contact_person, address, city, state, zip, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(f.name, f.contact_person, f.address, f.city, f.state, f.zip, f.phone, f.email)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateDonor(db: D1Database, id: number, f: DonorEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE donors SET name = ?, contact_person = ?, address = ?, city = ?, state = ?, zip = ?, phone = ?, email = ?
       WHERE id = ?`,
    )
    .bind(f.name, f.contact_person, f.address, f.city, f.state, f.zip, f.phone, f.email, id)
    .run();
}

export async function softDeleteDonor(db: D1Database, id: number, iso: string): Promise<void> {
  await db.prepare('UPDATE donors SET deleted_at = ? WHERE id = ?').bind(iso, id).run();
}

export async function restoreDonor(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE donors SET deleted_at = NULL WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/db-donors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-donors.test.ts
git commit -m "feat: donor directory db helpers (list/search/get/create/update/soft-delete/restore)"
```

---

### Task 2: Donation db helpers + year summary

**Files:**
- Modify: `src/lib/db.ts` (append at end, after Task 1 helpers)
- Test: `tests/db-donations.test.ts`

**Interfaces:**
- Consumes: `getTestDb`; `createDonor`/`DonorEdit` (T1) for seeding.
- Produces:
  - `type AdminDonation = { id: number; donor_id: number; date: string; item_description: string; amount: number | null }`
  - `listDonationsForDonor(db, donorId): Promise<AdminDonation[]>` — non-deleted, newest first.
  - `createDonation(db, donorId, v: { date: string; amount: number | null; itemDescription: string }): Promise<number>`
  - `softDeleteDonation(db, id, donorId, iso): Promise<void>` — scoped by `donor_id`.
  - `restoreDonation(db, id, donorId): Promise<void>` — scoped by `donor_id`.
  - `donationSummaryForYear(db, year: string): Promise<{ count: number; total: number }>` — non-deleted donations of non-deleted donors whose `date` starts with `year`; `total` sums non-null amounts.

- [ ] **Step 1: Write the failing test** — `tests/db-donations.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  createDonor, listDonationsForDonor, createDonation, softDeleteDonation, restoreDonation,
  donationSummaryForYear, type DonorEdit,
} from '../src/lib/db';

const blank: DonorEdit = { name: '', contact_person: '', address: '', city: '', state: '', zip: '', phone: '', email: '' };

describe('donation admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates donations under a donor and lists only that donor newest-first', async () => {
    const a = await createDonor(db, { ...blank, name: 'A' });
    const b = await createDonor(db, { ...blank, name: 'B' });
    await createDonation(db, a, { date: '2026-11-01', amount: 100, itemDescription: 'cash' });
    await createDonation(db, a, { date: '2026-11-05', amount: null, itemDescription: 'toys' });
    await createDonation(db, b, { date: '2026-11-03', amount: 50, itemDescription: '' });
    const forA = await listDonationsForDonor(db, a);
    expect(forA.map((d) => d.date)).toEqual(['2026-11-05', '2026-11-01']); // newest first
    expect(forA.every((d) => d.donor_id === a)).toBe(true);
  });

  it('soft-delete and restore are scoped by donor_id', async () => {
    const a = await createDonor(db, { ...blank, name: 'A2' });
    const b = await createDonor(db, { ...blank, name: 'B2' });
    const did = await createDonation(db, a, { date: '2026-11-01', amount: 10, itemDescription: '' });
    await softDeleteDonation(db, did, b, '2026-11-02T00:00:00Z'); // wrong donor: no-op
    expect((await listDonationsForDonor(db, a)).length).toBe(1);
    await softDeleteDonation(db, did, a, '2026-11-02T00:00:00Z'); // right donor
    expect((await listDonationsForDonor(db, a)).length).toBe(0);
    await restoreDonation(db, did, b); // wrong donor: no-op
    expect((await listDonationsForDonor(db, a)).length).toBe(0);
    await restoreDonation(db, did, a); // right donor
    expect((await listDonationsForDonor(db, a)).length).toBe(1);
  });

  it('summarizes a calendar year: count all, sum non-null amounts, ignore other years/deleted', async () => {
    const { db: db2, dispose: d2 } = await getTestDb();
    try {
      const a = await createDonor(db2, { ...blank, name: 'Sum' });
      await createDonation(db2, a, { date: '2026-01-15', amount: 200, itemDescription: '' });
      await createDonation(db2, a, { date: '2026-12-31', amount: null, itemDescription: 'toys' }); // counts, adds 0
      await createDonation(db2, a, { date: '2025-06-01', amount: 999, itemDescription: '' });       // other year
      const gone = await createDonation(db2, a, { date: '2026-02-02', amount: 500, itemDescription: '' });
      await softDeleteDonation(db2, gone, a, '2026-03-01T00:00:00Z');                                // excluded
      const s = await donationSummaryForYear(db2, '2026');
      expect(s).toEqual({ count: 2, total: 200 });
    } finally { await d2(); }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-donations.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/db.ts`

```ts
export type AdminDonation = { id: number; donor_id: number; date: string; item_description: string; amount: number | null };

export async function listDonationsForDonor(db: D1Database, donorId: number): Promise<AdminDonation[]> {
  const { results } = await db
    .prepare(
      `SELECT id, donor_id, date, item_description, amount FROM donations
       WHERE donor_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC`,
    )
    .bind(donorId)
    .all<AdminDonation>();
  return results;
}

export async function createDonation(
  db: D1Database,
  donorId: number,
  v: { date: string; amount: number | null; itemDescription: string },
): Promise<number> {
  const res = await db
    .prepare('INSERT INTO donations (donor_id, date, item_description, amount) VALUES (?, ?, ?, ?)')
    .bind(donorId, v.date, v.itemDescription, v.amount)
    .run();
  return res.meta.last_row_id as number;
}

export async function softDeleteDonation(db: D1Database, id: number, donorId: number, iso: string): Promise<void> {
  await db.prepare('UPDATE donations SET deleted_at = ? WHERE id = ? AND donor_id = ?').bind(iso, id, donorId).run();
}

export async function restoreDonation(db: D1Database, id: number, donorId: number): Promise<void> {
  await db.prepare('UPDATE donations SET deleted_at = NULL WHERE id = ? AND donor_id = ?').bind(id, donorId).run();
}

export async function donationSummaryForYear(db: D1Database, year: string): Promise<{ count: number; total: number }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(d.amount), 0) AS total
       FROM donations d JOIN donors dn ON dn.id = d.donor_id
       WHERE d.deleted_at IS NULL AND dn.deleted_at IS NULL AND substr(d.date, 1, 4) = ?`,
    )
    .bind(year)
    .first<{ count: number; total: number }>();
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/db-donations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-donations.test.ts
git commit -m "feat: donation db helpers (list/create/soft-delete/restore scoped by donor, year summary)"
```

---

### Task 3: Contact-message db helpers

**Files:**
- Modify: `src/lib/db.ts` (append at end, after Task 2 helpers)
- Test: `tests/db-messages.test.ts`

**Interfaces:**
- Consumes: `getTestDb`.
- Produces:
  - `type AdminMessage = { id: number; received_at: string; name: string; email: string; message: string; read_at: string | null }`
  - `listContactMessages(db): Promise<AdminMessage[]>` — newest first.
  - `setMessageRead(db, id, read: boolean, iso: string): Promise<void>` — sets `read_at` to `iso` when read, `NULL` when unread.
  - `deleteContactMessage(db, id): Promise<void>` — hard delete.
  - `unreadMessageCount(db): Promise<number>` — rows with `read_at IS NULL`.

- [ ] **Step 1: Write the failing test** — `tests/db-messages.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { listContactMessages, setMessageRead, deleteContactMessage, unreadMessageCount } from '../src/lib/db';

// Insert directly so we control received_at ordering and read state.
async function seed(db: D1Database, receivedAt: string, name: string, readAt: string | null) {
  await db
    .prepare('INSERT INTO contact_messages (received_at, name, email, message, read_at) VALUES (?, ?, ?, ?, ?)')
    .bind(receivedAt, name, `${name}@x.co`, 'hi', readAt)
    .run();
}

describe('contact message admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('lists newest first, counts unread, toggles read, and deletes', async () => {
    await seed(db, '2026-11-01T10:00:00Z', 'Old', null);
    await seed(db, '2026-11-03T10:00:00Z', 'New', null);
    await seed(db, '2026-11-02T10:00:00Z', 'Mid', '2026-11-02T12:00:00Z'); // already read

    let all = await listContactMessages(db);
    expect(all.map((m) => m.name)).toEqual(['New', 'Mid', 'Old']); // newest first
    expect(await unreadMessageCount(db)).toBe(2);

    const newMsg = all.find((m) => m.name === 'New')!;
    await setMessageRead(db, newMsg.id, true, '2026-11-03T11:00:00Z');
    expect(await unreadMessageCount(db)).toBe(1);
    await setMessageRead(db, newMsg.id, false, '2026-11-03T11:00:00Z');
    expect(await unreadMessageCount(db)).toBe(2);

    const oldMsg = all.find((m) => m.name === 'Old')!;
    await deleteContactMessage(db, oldMsg.id);
    all = await listContactMessages(db);
    expect(all.map((m) => m.name)).toEqual(['New', 'Mid']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/db-messages.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/db.ts`

```ts
export type AdminMessage = { id: number; received_at: string; name: string; email: string; message: string; read_at: string | null };

export async function listContactMessages(db: D1Database): Promise<AdminMessage[]> {
  const { results } = await db
    .prepare('SELECT id, received_at, name, email, message, read_at FROM contact_messages ORDER BY received_at DESC, id DESC')
    .all<AdminMessage>();
  return results;
}

export async function setMessageRead(db: D1Database, id: number, read: boolean, iso: string): Promise<void> {
  await db.prepare('UPDATE contact_messages SET read_at = ? WHERE id = ?').bind(read ? iso : null, id).run();
}

export async function deleteContactMessage(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM contact_messages WHERE id = ?').bind(id).run();
}

export async function unreadMessageCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS c FROM contact_messages WHERE read_at IS NULL').first<{ c: number }>();
  return row?.c ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/db-messages.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-messages.test.ts
git commit -m "feat: contact-message db helpers (list/read-toggle/delete/unread-count)"
```

---

### Task 4: Donors list page + restore endpoint

**Files:**
- Create: `src/pages/admin/donors/index.astro`
- Create: `src/pages/admin/donors/[id]/restore.ts`

**Interfaces:**
- Consumes: `listDonors`, `createDonor`, `softDeleteDonor`, `restoreDonor`, `donationSummaryForYear`, `type DonorEdit` (T1/T2); CSRF helpers.
- Produces: route `/admin/donors` (acts `create`, `delete`) and `/admin/donors/{id}/restore`.

- [ ] **Step 1: Create `src/pages/admin/donors/index.astro`**

Behavior: name search (via `listDonors`), "Add a donor" (name required → `?error=name`), soft-delete → `?undo=<id>` with an undo banner posting to the restore endpoint, a current-year donation summary, and each row links to the donor page. Mirrors `src/pages/admin/pickup/index.astro`.

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import { listDonors, createDonor, softDeleteDonor, donationSummaryForYear, type DonorEdit } from '../../../lib/db';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect('/admin/donors?error=csrf', 303);
  const act = String(form.get('act') ?? '');
  const id = Number(form.get('id'));
  if (act === 'create') {
    const g = (k: string) => String(form.get(k) ?? '').trim();
    if (g('name') === '') return Astro.redirect('/admin/donors?error=name', 303);
    const f: DonorEdit = {
      name: g('name'), contact_person: g('contact_person'), address: g('address'), city: g('city'),
      state: g('state'), zip: g('zip'), phone: g('phone'), email: g('email'),
    };
    await createDonor(env.DB, f);
    return Astro.redirect('/admin/donors?saved=added', 303);
  } else if (act === 'delete' && Number.isInteger(id)) {
    await softDeleteDonor(env.DB, id, new Date().toISOString());
    return Astro.redirect(`/admin/donors?undo=${id}`, 303);
  }
  return Astro.redirect('/admin/donors', 303);
}

const url = new URL(Astro.request.url);
const search = url.searchParams.get('q') ?? '';
const undoRaw = url.searchParams.get('undo');
const undoId = undoRaw && /^\d+$/.test(undoRaw) ? undoRaw : null;
const saved = url.searchParams.get('saved');
const banner = saved === 'added' ? 'Donor added.'
  : url.searchParams.get('error') === 'name' ? 'Please enter the donor\'s name.'
  : url.searchParams.get('error') === 'csrf' ? 'That didn\'t save — please try again.'
  : url.searchParams.get('restored') === '1' ? 'It\'s back in your list.' : '';

const donors = await listDonors(env.DB, search);
const year = String(new Date().getFullYear());
const summary = await donationSummaryForYear(env.DB, year);

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
---
<Admin title="Donors" heading="Donors and donations" back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">Help: search or add a donor below, then open a donor to record their donations.</p>

  {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}
  {undoId && (
    <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status">
      <form method="post" action={`/admin/donors/${undoId}/restore`} class="flex flex-wrap items-center gap-3">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <span class="font-semibold">That donor was deleted.</span>
        <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Undo delete</button>
      </form>
    </div>
  )}

  <p class="mt-4 text-xl"><strong>This year ({year}):</strong> {summary.count} donations, ${summary.total.toFixed(2)} total.</p>

  <form method="get" class="mt-4 flex items-end gap-2">
    <label class="font-semibold">Search by name
      <input type="text" name="q" value={search} class="ml-2 rounded border-2 border-stone-400 p-2 text-lg" />
    </label>
    <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Search</button>
  </form>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">Donors</h2>
  {donors.length === 0 ? <p class="mt-2 text-lg">No donors found.</p> : (
    <ul class="mt-2 space-y-2">
      {donors.map((d) => (
        <li class="rounded-lg border-2 border-stone-300 bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <a href={`/admin/donors/${d.id}`} class="text-xl font-bold text-holly-800 underline">{d.name}</a>
              <p class="text-stone-700">{[d.contact_person, d.city, d.phone].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <form method="post" data-confirm="Delete this donor? You'll get an Undo link right after.">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="id" value={String(d.id)} />
              <button type="submit" name="act" value="delete" class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Delete</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  )}

  <section class="mt-8 rounded-lg border-2 border-holly-700 bg-white p-5">
    <h2 class="text-2xl font-bold text-holly-800">Add a donor</h2>
    <form method="post" class="mt-3 space-y-3">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block font-semibold">Name (required)<input class={input} type="text" name="name" /></label>
        <label class="block font-semibold">Contact person<input class={input} type="text" name="contact_person" /></label>
        <label class="block font-semibold">Address<input class={input} type="text" name="address" /></label>
        <label class="block font-semibold">City<input class={input} type="text" name="city" /></label>
        <label class="block font-semibold">State<input class={input} type="text" name="state" /></label>
        <label class="block font-semibold">Zip<input class={input} type="text" name="zip" /></label>
        <label class="block font-semibold">Phone<input class={input} type="text" name="phone" /></label>
        <label class="block font-semibold">Email<input class={input} type="email" name="email" /></label>
      </div>
      <button type="submit" name="act" value="create" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Add this donor</button>
    </form>
  </section>

  <script src="/scripts/print-button.js" defer></script>
</Admin>
```

- [ ] **Step 2: Create `src/pages/admin/donors/[id]/restore.ts`** (mirror `pickup/[id]/restore.ts`)

```ts
import type { APIRoute } from 'astro';
import { restoreDonor } from '../../../../lib/db';
import { verifyCsrf } from '../../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request, cookies, redirect }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  if (!ok) return redirect('/admin/donors?error=csrf', 303);
  if (Number.isInteger(id)) await restoreDonor(locals.runtime.env.DB, id);
  return redirect('/admin/donors?restored=1', 303);
};
```

- [ ] **Step 3: Verify build + typecheck**

Run: `npm run build` then `npx tsc --noEmit`
Expected: build Complete!, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/donors/index.astro src/pages/admin/donors/[id]/restore.ts
git commit -m "feat: donors list page (search, add, year summary, soft-delete + undo)"
```

---

### Task 5: Donor page (edit donor + donations)

**Files:**
- Create: `src/pages/admin/donors/[id].astro`

**Interfaces:**
- Consumes: `getDonor`, `updateDonor`, `listDonationsForDonor`, `createDonation`, `softDeleteDonation`, `restoreDonation`, `type DonorEdit` (T1/T2); `parseMoney` from `src/lib/validation/application`; CSRF helpers.
- Produces: route `/admin/donors/{id}` with acts `save_donor`, `add_donation`, `delete_donation`, `restore_donation`.

- [ ] **Step 1: Create `src/pages/admin/donors/[id].astro`**

Behavior: an Edit-donor form (name required → `?error=name`); the donor's donation history; an Add-a-donation form (date defaults to today; require date present AND (amount valid via `parseMoney` OR item non-empty) → else `?error=donation`); per-donation soft-delete → `?undo_donation=<did>` with an inline undo (act `restore_donation`). All child ops scoped to this donor via the route id.

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import {
  getDonor, updateDonor, listDonationsForDonor, createDonation, softDeleteDonation, restoreDonation, type DonorEdit,
} from '../../../lib/db';
import { parseMoney } from '../../../lib/validation/application';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);
const base = `/admin/donors/${id}`;

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect(`${base}?error=csrf`, 303);
  const act = String(form.get('act') ?? '');
  const g = (k: string) => String(form.get(k) ?? '').trim();
  const donationId = Number(form.get('donation_id'));

  if (act === 'save_donor') {
    if (g('name') === '') return Astro.redirect(`${base}?error=name`, 303);
    const f: DonorEdit = {
      name: g('name'), contact_person: g('contact_person'), address: g('address'), city: g('city'),
      state: g('state'), zip: g('zip'), phone: g('phone'), email: g('email'),
    };
    await updateDonor(env.DB, id, f);
    return Astro.redirect(`${base}?saved=donor`, 303);
  } else if (act === 'add_donation') {
    const date = g('date');
    const rawAmount = g('amount');
    const amount = rawAmount === '' ? null : parseMoney(rawAmount);
    const item = g('item_description');
    // Require a date and at least an amount or an item; a non-blank amount must be valid money.
    if (date === '' || (rawAmount !== '' && amount === null) || (amount === null && item === '')) {
      return Astro.redirect(`${base}?error=donation`, 303);
    }
    await createDonation(env.DB, id, { date, amount, itemDescription: item });
    return Astro.redirect(`${base}?saved=donation`, 303);
  } else if (act === 'delete_donation' && Number.isInteger(donationId)) {
    await softDeleteDonation(env.DB, donationId, id, new Date().toISOString());
    return Astro.redirect(`${base}?undo_donation=${donationId}`, 303);
  } else if (act === 'restore_donation' && Number.isInteger(donationId)) {
    await restoreDonation(env.DB, donationId, id);
    return Astro.redirect(`${base}?restored_donation=1`, 303);
  }
  return Astro.redirect(base, 303);
}

const donor = Number.isInteger(id) ? await getDonor(env.DB, id) : null;
const donations = donor ? await listDonationsForDonor(env.DB, id) : [];

const url = new URL(Astro.request.url);
const undoRaw = url.searchParams.get('undo_donation');
const undoDonationId = undoRaw && /^\d+$/.test(undoRaw) ? undoRaw : null;
const saved = url.searchParams.get('saved');
const banner = saved === 'donor' ? 'Saved.' : saved === 'donation' ? 'Donation added.'
  : url.searchParams.get('error') === 'name' ? 'Please enter the donor\'s name.'
  : url.searchParams.get('error') === 'donation' ? 'Please enter a date and an amount or an item.'
  : url.searchParams.get('error') === 'csrf' ? 'That didn\'t save — please try again.'
  : url.searchParams.get('restored_donation') === '1' ? 'The donation is back.' : '';

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
const today = new Date().toISOString().slice(0, 10);
const d = donor ?? {} as Record<string, string>;
const money = (v: number | null) => (v == null ? '' : `$${Number(v).toFixed(2)}`);
---
<Admin title="Donor" heading={donor ? donor.name : 'Donor not found'} back={{ href: '/admin/donors', label: 'Back to donors' }}>
  {!donor ? <p class="mt-4">That donor could not be found.</p> : (
    <>
      {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}
      {undoDonationId && (
        <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status">
          <form method="post" class="flex flex-wrap items-center gap-3">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="donation_id" value={undoDonationId} />
            <span class="font-semibold">That donation was deleted.</span>
            <button type="submit" name="act" value="restore_donation" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Undo delete</button>
          </form>
        </div>
      )}

      <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Donor details</h2>
        <form method="post" class="mt-3 space-y-3">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block font-semibold">Name (required)<input class={input} type="text" name="name" value={d.name} /></label>
            <label class="block font-semibold">Contact person<input class={input} type="text" name="contact_person" value={d.contact_person} /></label>
            <label class="block font-semibold">Address<input class={input} type="text" name="address" value={d.address} /></label>
            <label class="block font-semibold">City<input class={input} type="text" name="city" value={d.city} /></label>
            <label class="block font-semibold">State<input class={input} type="text" name="state" value={d.state} /></label>
            <label class="block font-semibold">Zip<input class={input} type="text" name="zip" value={d.zip} /></label>
            <label class="block font-semibold">Phone<input class={input} type="text" name="phone" value={d.phone} /></label>
            <label class="block font-semibold">Email<input class={input} type="email" name="email" value={d.email} /></label>
          </div>
          <button type="submit" name="act" value="save_donor" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save donor</button>
        </form>
      </section>

      <h2 class="mt-8 text-2xl font-bold text-holly-800">Donations</h2>
      {donations.length === 0 ? <p class="mt-2 text-lg">No donations recorded yet.</p> : (
        <ul class="mt-2 space-y-2">
          {donations.map((dn) => (
            <li class="rounded-lg border-2 border-stone-300 bg-white p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="text-lg">{dn.date} · {money(dn.amount)}{dn.amount != null && dn.item_description ? ' · ' : ''}{dn.item_description}</span>
                <form method="post" data-confirm="Delete this donation? You'll get an Undo link right after.">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <input type="hidden" name="donation_id" value={String(dn.id)} />
                  <button type="submit" name="act" value="delete_donation" class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section class="mt-6 rounded-lg border-2 border-holly-700 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Add a donation</h2>
        <form method="post" class="mt-3 space-y-3">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <div class="grid gap-4 sm:grid-cols-3">
            <label class="block font-semibold">Date<input class={input} type="date" name="date" value={today} /></label>
            <label class="block font-semibold">Amount ($)<input class={input} type="text" inputmode="decimal" name="amount" /></label>
            <label class="block font-semibold">Item (if not cash)<input class={input} type="text" name="item_description" /></label>
          </div>
          <button type="submit" name="act" value="add_donation" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Add this donation</button>
        </form>
      </section>

      <script src="/scripts/print-button.js" defer></script>
    </>
  )}
</Admin>
```

- [ ] **Step 2: Verify build + typecheck**

Run: `npm run build` then `npx tsc --noEmit`
Expected: build Complete!, tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/donors/[id].astro
git commit -m "feat: donor page (edit donor, record and remove donations with undo)"
```

---

### Task 6: Messages inbox

**Files:**
- Create: `src/pages/admin/messages/index.astro`

**Interfaces:**
- Consumes: `listContactMessages`, `setMessageRead`, `deleteContactMessage` (T3); CSRF helpers.
- Produces: route `/admin/messages` with acts `mark_read`, `mark_unread`, `delete`.

- [ ] **Step 1: Create `src/pages/admin/messages/index.astro`**

Behavior: list newest first; per-row Mark read / Mark unread (toggles `read_at`), a `mailto:` Reply link, and a hard Delete guarded by `data-confirm`. Unread rows visually flagged.

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import { listContactMessages, setMessageRead, deleteContactMessage } from '../../../lib/db';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (!okCsrf) return Astro.redirect('/admin/messages?error=csrf', 303);
  const act = String(form.get('act') ?? '');
  const id = Number(form.get('id'));
  if (Number.isInteger(id)) {
    if (act === 'mark_read') {
      await setMessageRead(env.DB, id, true, new Date().toISOString());
      return Astro.redirect('/admin/messages?saved=read', 303);
    } else if (act === 'mark_unread') {
      await setMessageRead(env.DB, id, false, new Date().toISOString());
      return Astro.redirect('/admin/messages?saved=unread', 303);
    } else if (act === 'delete') {
      await deleteContactMessage(env.DB, id);
      return Astro.redirect('/admin/messages?saved=deleted', 303);
    }
  }
  return Astro.redirect('/admin/messages', 303);
}

const url = new URL(Astro.request.url);
const saved = url.searchParams.get('saved');
const banner = saved === 'read' ? 'Marked as read.' : saved === 'unread' ? 'Marked as unread.'
  : saved === 'deleted' ? 'Message deleted.'
  : url.searchParams.get('error') === 'csrf' ? 'That didn\'t save — please try again.' : '';

const messages = await listContactMessages(env.DB);

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const fmtDate = (iso: string) => iso.slice(0, 10);
---
<Admin title="Messages" heading="Messages" back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">Help: these are messages sent through the Contact form. They also come to your email. Reply opens your email program.</p>

  {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}

  {messages.length === 0 ? <p class="mt-6 text-lg">No messages yet.</p> : (
    <ul class="mt-6 space-y-3">
      {messages.map((m) => (
        <li class={`rounded-lg border-2 p-5 ${m.read_at ? 'border-stone-300 bg-white' : 'border-holly-700 bg-holly-100'}`}>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xl font-bold text-holly-800">{m.name || '(no name given)'} {!m.read_at && <span class="ml-2 rounded bg-holly-700 px-2 py-1 font-bold text-white">New</span>}</p>
            <p class="text-lg text-stone-600">{fmtDate(m.received_at)}</p>
          </div>
          <p class="text-lg">{m.email}</p>
          <p class="mt-2 whitespace-pre-wrap">{m.message}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to the Holiday Project')}`} class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Reply by email</a>
            <form method="post">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="id" value={String(m.id)} />
              <button type="submit" name="act" value={m.read_at ? 'mark_unread' : 'mark_read'} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800">{m.read_at ? 'Mark unread' : 'Mark read'}</button>
            </form>
            <form method="post" data-confirm="Delete this message? This can't be undone.">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="id" value={String(m.id)} />
              <button type="submit" name="act" value="delete" class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Delete</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  )}

  <script src="/scripts/print-button.js" defer></script>
</Admin>
```

Note: the unread row is visually distinguished by its border/background AND the "New" badge; the badge inherits the ≥18px body size (no shrink) to stay within the admin font floor.

- [ ] **Step 2: Verify build + typecheck**

Run: `npm run build` then `npx tsc --noEmit`
Expected: build Complete!, tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/messages/index.astro
git commit -m "feat: messages inbox (read/unread toggle, mailto reply, delete with confirm)"
```

---

### Task 7: Navigation — nav sections + admin-home cards

**Files:**
- Modify: `src/layouts/Admin.astro` (the `sections` array, lines 8-14)
- Modify: `src/components/admin/AdminHome.astro`

**Interfaces:**
- Consumes: `unreadMessageCount` (T3).
- Produces: nothing new; wires the new pages into navigation.

- [ ] **Step 1: Add two nav sections** — `src/layouts/Admin.astro`

Replace the `sections` array so it reads:

```ts
const sections = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/applications', label: 'Applications this year' },
  { href: '/admin/content', label: "This year's news" },
  { href: '/admin/pickup', label: 'Pickup schedule' },
  { href: '/admin/paper-application', label: 'Paper application' },
  { href: '/admin/donors', label: 'Donors' },
  { href: '/admin/messages', label: 'Messages' },
];
```

- [ ] **Step 2: Add two cards to the admin home** — `src/components/admin/AdminHome.astro`

Change the import on line 2 to also pull in `unreadMessageCount`:

```astro
import { getSettings, unreadMessageCount } from '../../lib/db';
```

After the `const settings = ...` line (line 5), add:

```astro
const unread = await unreadMessageCount(Astro.locals.runtime.env.DB);
```

Then, inside the `<div class="mt-8 grid gap-4 sm:grid-cols-2">` card grid, add these two cards after the existing "Paper application" card (before the closing `</div>` of the grid):

```astro
        <a href="/admin/donors" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Donations & donors</span>
          <span class="mt-1 block text-lg text-stone-700">Keep the donor list and record what each donor gives.</span>
        </a>
        <a href="/admin/messages" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Messages{unread > 0 ? ` (${unread} unread)` : ''}</span>
          <span class="mt-1 block text-lg text-stone-700">Read messages families sent through the Contact form.</span>
        </a>
```

- [ ] **Step 3: Verify build + typecheck + full suite**

Run: `npm run build` then `npx tsc --noEmit` then `npm run test`
Expected: build Complete!, tsc clean, all tests green (baseline 133 + the new db-donors/db-donations/db-messages tests).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/Admin.astro src/components/admin/AdminHome.astro
git commit -m "feat: wire Donors and Messages into admin nav and home (unread count)"
```

---

## Self-Review

**1. Spec coverage:**
- Donor directory (list/search/add/edit/soft-delete+undo) → T1 (helpers) + T4 (list page + restore) + T5 (edit form). ✓
- Donation tracking donor-centric (history + add + remove + undo, scoped by donor_id) → T2 (helpers) + T5 (page). ✓
- Admin-only year summary → T2 (`donationSummaryForYear`) + T4 (rendered). ✓
- Contact-messages inbox (list newest-first, read/unread, hard-delete-with-confirm, mailto reply) → T3 (helpers) + T6 (page). ✓
- Nav: Admin sections +2, AdminHome +2 cards with unread count fetched by AdminHome itself → T7. ✓
- Soft-delete for donors/donations, hard-delete for messages → T1/T2 (soft) vs T3 (`deleteContactMessage` hard) + T6 (`data-confirm`). ✓
- CSRF-first + `?error=csrf` banners; PRG; `data-confirm`; escapeLike search; parseMoney amounts; straight apostrophes → every page task. ✓
- No schema change; no public-site change. ✓
- TDD for all db helpers → T1, T2, T3 each lead with a failing test. ✓

**2. Placeholder scan:** No TBD/TODO; every code step is complete. No "similar to Task N" — each page is written in full.

**3. Type consistency:** `AdminDonor`/`DonorEdit` (T1) consumed by T4/T5; `AdminDonation` + `createDonation({date, amount, itemDescription})` (T2) consumed by T5; `AdminMessage` + `unreadMessageCount` (T3) consumed by T6/T7. `donationSummaryForYear(db, year: string)` takes a string; T4 passes `String(new Date().getFullYear())`. Donation soft-delete/restore are `(db, id, donorId, iso?)` and the page passes the route id as `donorId`. All aligned.

**Note for the executor:** donation delete/undo is handled inline on the donor page (acts `delete_donation`/`restore_donation`), NOT via a separate endpoint — only the donor soft-delete uses a `restore.ts` endpoint (mirroring content/pickup). This is intentional: donations are sub-records of the donor page.
