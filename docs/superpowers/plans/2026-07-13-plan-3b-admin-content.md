# Plan 3b: Admin Console — Content Management + Login Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the operator manage this year's content herself and log in reliably: harden the magic-link against email link-scanners, add the applications-open toggle, the news/gifts editor, the pickup-schedule editor, and paper-application PDF upload.

**Architecture:** Same stack and patterns as Plan 3a. New data operations are pure/integration-tested helpers appended to `src/lib/db.ts`; each admin editor is a thin server page using the existing `Admin` layout, CSRF, and the auth-gate middleware. This is Plan 3b of the admin console; Plan 3c adds donors/donations, contact messages, member-level application editing, and the applications-workflow polish carried in docs/decisions.md.

**Tech Stack:** unchanged — Astro 5 + @astrojs/cloudflare, Tailwind 4, D1, R2 (for the PDF), Resend via fetch, Vitest, wrangler. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-gchp-site-design.md` §5 (admin console — screens 2, 6, 7, 8), §6 (auth), §7 (security). Decisions/binding notes: `docs/decisions.md`. Spec governs on conflict.
- **No new dependencies.** Runtime: `astro`, `@astrojs/cloudflare`, `tailwindcss`, `@tailwindcss/vite`. Dev: `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`.
- **Admin usability (spec §5, non-negotiable):** every admin screen ≥ 18px text (no Tailwind class below `text-lg` under `/admin` except print-only slip markup), high contrast, plain English (say "This year's news", "Pickup schedule", "Paper application"), text labels on every button (never icon-only), one clear primary action, an obvious **Back**, a one-sentence **Help** note. Confirmation before anything destructive; soft-delete with a visible **Undo** where the table has a `deleted_at` column (`content_blocks`, `pickup_days`). Light festive touch, otherwise calm and plain.
- **Security (spec §7):** CSRF token on every state-changing admin form (reuse-or-mint the `csrf` cookie: read existing, reuse if it matches `/^[0-9a-f]{64}$/`, else `newCsrfCookieValue()`; set HttpOnly+SameSite=Lax+path=/+Secure). All D1 access via prepared statements with `.bind()`. `/admin` responses stay `no-store` (middleware). No secrets in the repo. No PII in logs/URLs.
- **Straight apostrophes (') only** in all code-authored copy — never typographic (’). This includes the Task 11 sweep of `src/lib/validation/application.ts`.
- Every admin page: exactly one `<h1>` (the `Admin` layout renders it from the `heading` prop; bare pages supply their own single `<h1>`). Works with JavaScript disabled (the only JS is the existing `public/scripts/print-button.js` for print/confirm; new editors must not require JS).
- **The auth gate is by URL prefix (`src/middleware.ts`):** `/admin` and `/admin/verify` are public (both GET and POST); everything else under `/admin/*` requires a session and 303s to `/admin` otherwise. New editor routes are protected for free; the verify interstitial's POST stays public because `/admin/verify` is in the public set.
- Node ≥ 22; repo root is the project root; Git Bash on Windows. Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Plan 3a's suite has **112 tests**; every task keeps prior tests green. Run the full suite before each commit.

## Existing interfaces consumed (exact)

- `src/lib/auth.ts`: `consumeLoginToken(db, rawToken, now): Promise<string|null>` (Task 1 makes it atomic), `createSession(db, email, now): Promise<string>`, `SESSION_MS`, `sha256Hex` (via auth-crypto).
- `src/lib/csrf.ts`: `newCsrfCookieValue()`, `csrfTokenFor(secret, cookieValue)`, `verifyCsrf(secret, cookieValue, token)`.
- `src/lib/db.ts`: `getSettings(db)` → `Settings { applications_open:number; pickup_title:string; pickup_intro:string; pickup_footer:string; pdf_uploaded_at:string|null }`; `listContentBlocks(db)` → `ContentBlock { id; title; subtitle; body }` (public, non-deleted, ordered); `listPickupDays(db)` → `PickupDay { id; date_text; description }`. **Append** new helpers; never edit existing exports.
- `src/layouts/Admin.astro`: `<Admin title heading back?={{href,label}}>` with a `sections` nav list (Task 10 extends it). `src/components/admin/AdminHome.astro`: the signed-in hub (Task 6 & 10 extend it).
- `src/env.d.ts`: `Env` (DB, FILES [R2], RESEND_API_KEY, CSRF_SECRET, EMAIL_FROM, EMAIL_REPLY_TO, CONTACT_TO); `App.Locals.runtime`, `App.Locals.adminEmail`.
- Schema (`migrations/0001_init.sql`): `settings` (single row id=1), `content_blocks` (id, title, subtitle, body, sort_order, deleted_at), `pickup_days` (id, sort_order, date_text, description, deleted_at). R2 object key served by `/application.pdf`: `application.pdf`.
- Test harness `tests/helpers/d1.ts`: `getTestDb()` — fresh local D1 with schema + seed city 13 + settings row (id=1). Content/pickup seed rows are NOT present in the test DB (only migration 0001 is applied); tests insert their own.

---

### Task 1: Make login-token consumption atomic (TDD)

**Files:**
- Modify: `src/lib/auth.ts` (`consumeLoginToken` body only)
- Modify: `tests/auth.test.ts` (add one concurrency-shaped test)

**Interfaces:**
- Consumes: `sha256Hex`.
- Produces: same signature `consumeLoginToken(db, rawToken, now): Promise<string|null>`, now a single atomic `UPDATE ... WHERE used_at IS NULL AND expires_at >= ? RETURNING email`. Behavior is unchanged for all existing tests; two racing consumers now yield exactly one success.

- [ ] **Step 1: Add the failing test**

Append inside the `describe('auth data layer', ...)` block in `tests/auth.test.ts`:

```ts
  it('lets only one of two racing consumers win a single-use token', async () => {
    const token = await createLoginToken(db, 'boss@example.com', T0);
    const [a, b] = await Promise.all([
      consumeLoginToken(db, token, T0 + 1000),
      consumeLoginToken(db, token, T0 + 1000),
    ]);
    const wins = [a, b].filter((r) => r === 'boss@example.com').length;
    expect(wins).toBe(1);
  });
```

- [ ] **Step 2: Run — expect it may pass or fail depending on timing**

Run: `npm run test`
Expected: the new test is flaky/failing under the current read-then-write implementation (both reads can see `used_at IS NULL` before either write). If it happens to pass, proceed anyway — the atomic rewrite makes it deterministic. The other 112 tests stay green.

- [ ] **Step 3: Rewrite consumeLoginToken atomically**

In `src/lib/auth.ts`, replace the entire `consumeLoginToken` function with:

```ts
export async function consumeLoginToken(
  db: D1Database,
  rawToken: string,
  now: number,
): Promise<string | null> {
  // One atomic statement: claim the token only if it is unused and unexpired.
  // RETURNING makes the winning claimer the only caller that gets the email,
  // so two racing sign-in clicks (or a scanner + a human) can't both succeed.
  const nowIso = iso(now);
  const row = await db
    .prepare(
      `UPDATE login_tokens SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?
       RETURNING email`,
    )
    .bind(nowIso, await sha256Hex(rawToken), nowIso)
    .first<{ email: string }>();
  return row?.email ?? null;
}
```

(`iso` and `sha256Hex` are already in scope in this file. ISO-8601 UTC strings compare lexicographically in the same order as chronologically, so `expires_at >= nowIso` is a correct expiry check.)

- [ ] **Step 4: Run to verify all pass**

Run: `npm run test`
Expected: all green including the new race test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/auth.test.ts
git commit -m "fix: atomic single-use login token consumption"
```

---

### Task 2: Magic-link verify interstitial (scanner-safe sign-in)

**Files:**
- Modify: `src/pages/admin/verify.ts` → replace with `src/pages/admin/verify.astro` (delete the `.ts`, create the `.astro`)

**Interfaces:**
- Consumes: `consumeLoginToken`, `createSession`, `SESSION_MS`.
- Produces: `/admin/verify?token=…` GET renders a one-button "Sign me in" page and does NOT consume the token; POST (same route, token in a hidden field) consumes atomically, sets the `admin_session` cookie, 303 → `/admin`. This defeats email link-scanners (which issue GET, not a button POST) that would otherwise burn the operator's single-use link before she clicks.

- [ ] **Step 1: Delete the old GET-consumes endpoint**

```bash
git rm src/pages/admin/verify.ts
```

- [ ] **Step 2: Create the interstitial page**

`src/pages/admin/verify.astro`:

```astro
---
import '../../styles/global.css';
import { consumeLoginToken, createSession, SESSION_MS } from '../../lib/auth';
export const prerender = false;

const env = Astro.locals.runtime.env;
const url = new URL(Astro.request.url);
// GET carries the token in the query; POST carries it in the form so a
// link-scanner's GET never consumes it.
let token = url.searchParams.get('token') ?? '';
let failed = false;

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  token = String(form.get('token') ?? '');
  const email = await consumeLoginToken(env.DB, token, Date.now());
  if (email) {
    const sessionId = await createSession(env.DB, email, Date.now());
    Astro.cookies.set('admin_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      maxAge: Math.floor(SESSION_MS / 1000),
    });
    return Astro.redirect('/admin', 303);
  }
  failed = true;
}

const looksValid = /^[0-9a-f]{64}$/.test(token);
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in — GCHP Admin</title>
  </head>
  <body class="min-h-screen bg-cream text-stone-900 text-lg leading-relaxed">
    <main class="mx-auto max-w-md px-4 py-16">
      <h1 class="text-3xl font-bold text-holly-800">Grant County Holiday Project — Admin</h1>
      {failed || !looksValid ? (
        <div class="mt-6 rounded border-l-4 border-berry-700 bg-white p-5">
          <p class="text-xl font-bold text-berry-800">That link didn't work</p>
          <p class="mt-2">Your sign-in link may have expired or already been used. They last 15 minutes.</p>
          <p class="mt-2"><a href="/admin" class="font-semibold text-berry-700 underline">Get a new sign-in link</a></p>
        </div>
      ) : (
        <div class="mt-6 rounded border-l-4 border-holly-700 bg-white p-5">
          <p class="text-xl font-bold text-holly-800">You're almost in</p>
          <p class="mt-2">Click the button below to finish signing in.</p>
          <form method="post" class="mt-4">
            <input type="hidden" name="token" value={token} />
            <button type="submit" class="w-full rounded-lg bg-holly-700 px-6 py-3 text-lg font-bold text-white hover:bg-holly-900">
              Sign me in
            </button>
          </form>
        </div>
      )}
    </main>
  </body>
</html>
```

(No CSRF token here by design: the single-use, high-entropy link token in the hidden field is itself the anti-forgery secret, and this page runs before any session exists. A cross-site attacker cannot forge the POST without already holding the victim's token.)

- [ ] **Step 3: Verify the loop live**

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8`. Mint a real token through the sign-in path, then confirm GET does not consume and POST does. Because the raw token only exists in the (dev-key-failing) email, instead insert a token directly with a known raw value:

```bash
RAW=$(node -e "const b=new Uint8Array(32);crypto.getRandomValues(b);process.stdout.write([...b].map(x=>x.toString(16).padStart(2,'0')).join(''))")
HASH=$(node -e "crypto.subtle.digest('SHA-256',new TextEncoder().encode(process.argv[1])).then(d=>process.stdout.write([...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join(''))" "$RAW")
npx wrangler d1 execute gchp --local --command "INSERT INTO login_tokens (token_hash,email,expires_at) VALUES ('$HASH','boss@example.com','2099-01-01T00:00:00.000Z')"
# GET must NOT consume (token still unused after):
curl -s "http://localhost:4321/admin/verify?token=$RAW" | grep -o "Sign me in"   # Expected: match
npx wrangler d1 execute gchp --local --command "SELECT used_at FROM login_tokens WHERE token_hash='$HASH'"   # Expected: used_at still empty
# POST consumes and sets a session cookie (302/303 with Set-Cookie admin_session):
curl -s -i -X POST "http://localhost:4321/admin/verify" --data-urlencode "token=$RAW" | grep -iE "HTTP/|location:|set-cookie: admin_session"   # Expected: 303, Location /admin, Set-Cookie admin_session
npx wrangler d1 execute gchp --local --command "SELECT used_at FROM login_tokens WHERE token_hash='$HASH'"   # Expected: used_at now set
```

Clean up: `npx wrangler d1 execute gchp --local --command "DELETE FROM login_tokens; DELETE FROM sessions"`. Kill the dev server. Run `npm run test` (112 green) and `npm run build` (Complete!).

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/verify.astro
git commit -m "feat: scanner-safe magic-link verify interstitial (click to confirm)"
```

---

### Task 3: Settings write helpers (TDD)

**Files:**
- Modify: `src/lib/db.ts` (append)
- Test: `tests/db-settings.test.ts`

**Interfaces:**
- Consumes: `getTestDb`, `getSettings`.
- Produces:
  - `setApplicationsOpen(db, open: boolean): Promise<void>`
  - `updatePickupText(db, v: { title: string; intro: string; footer: string }): Promise<void>`
  - `setPdfUploadedAt(db, iso: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`tests/db-settings.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { getSettings, setApplicationsOpen, updatePickupText, setPdfUploadedAt } from '../src/lib/db';

describe('settings writes', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('toggles applications_open both ways', async () => {
    await setApplicationsOpen(db, true);
    expect((await getSettings(db)).applications_open).toBe(1);
    await setApplicationsOpen(db, false);
    expect((await getSettings(db)).applications_open).toBe(0);
  });

  it('updates the pickup text fields', async () => {
    await updatePickupText(db, { title: 'T', intro: 'I', footer: 'F' });
    const s = await getSettings(db);
    expect([s.pickup_title, s.pickup_intro, s.pickup_footer]).toEqual(['T', 'I', 'F']);
  });

  it('records the pdf upload time', async () => {
    await setPdfUploadedAt(db, '2026-10-02T00:00:00.000Z');
    expect((await getSettings(db)).pdf_uploaded_at).toBe('2026-10-02T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — the three helpers are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
export async function setApplicationsOpen(db: D1Database, open: boolean): Promise<void> {
  await db.prepare('UPDATE settings SET applications_open = ? WHERE id = 1').bind(open ? 1 : 0).run();
}

export async function updatePickupText(
  db: D1Database,
  v: { title: string; intro: string; footer: string },
): Promise<void> {
  await db
    .prepare('UPDATE settings SET pickup_title = ?, pickup_intro = ?, pickup_footer = ? WHERE id = 1')
    .bind(v.title, v.intro, v.footer)
    .run();
}

export async function setPdfUploadedAt(db: D1Database, iso: string): Promise<void> {
  await db.prepare('UPDATE settings SET pdf_uploaded_at = ? WHERE id = 1').bind(iso).run();
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/db.ts tests/db-settings.test.ts
git commit -m "feat: settings write helpers (applications-open, pickup text, pdf timestamp)"
```

---

### Task 4: Content-block admin db helpers (TDD)

**Files:**
- Modify: `src/lib/db.ts` (append)
- Test: `tests/db-content.test.ts`

**Interfaces:**
- Consumes: `getTestDb`.
- Produces:
  - `type AdminContentBlock = { id: number; title: string; subtitle: string; body: string; sort_order: number }`
  - `listAllContentBlocks(db): Promise<AdminContentBlock[]>` — non-deleted, ordered by `sort_order, id`.
  - `createContentBlock(db, v: { title: string; subtitle: string; body: string }): Promise<number>` — appends at the end (sort_order = current max + 1), returns new id.
  - `updateContentBlock(db, id, v: { title: string; subtitle: string; body: string }): Promise<void>`
  - `softDeleteContentBlock(db, id, iso): Promise<void>` / `restoreContentBlock(db, id): Promise<void>`
  - `moveContentBlock(db, id, dir: 'up' | 'down'): Promise<void>` — renumbers non-deleted blocks 1..n after swapping the target with its neighbor; no-op at an end.

- [ ] **Step 1: Write the failing tests**

`tests/db-content.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  listAllContentBlocks, createContentBlock, updateContentBlock,
  softDeleteContentBlock, restoreContentBlock, moveContentBlock,
} from '../src/lib/db';

describe('content block admin helpers', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates blocks appended in order and lists them', async () => {
    const a = await createContentBlock(db, { title: 'A', subtitle: 'a', body: 'aa' });
    const b = await createContentBlock(db, { title: 'B', subtitle: 'b', body: 'bb' });
    const rows = await listAllContentBlocks(db);
    expect(rows.map((r) => r.title)).toEqual(['A', 'B']);
    expect(rows[0].sort_order).toBeLessThan(rows[1].sort_order);
    expect([a, b].every((id) => id > 0)).toBe(true);
  });

  it('updates a block', async () => {
    const id = await createContentBlock(db, { title: 'X', subtitle: '', body: '' });
    await updateContentBlock(db, id, { title: 'X2', subtitle: 's', body: 'y' });
    const row = (await listAllContentBlocks(db)).find((r) => r.id === id)!;
    expect([row.title, row.subtitle, row.body]).toEqual(['X2', 's', 'y']);
  });

  it('soft-deletes and restores', async () => {
    const id = await createContentBlock(db, { title: 'Gone', subtitle: '', body: '' });
    await softDeleteContentBlock(db, id, '2026-10-05T00:00:00Z');
    expect((await listAllContentBlocks(db)).some((r) => r.id === id)).toBe(false);
    await restoreContentBlock(db, id);
    expect((await listAllContentBlocks(db)).some((r) => r.id === id)).toBe(true);
  });

  it('moves a block up and down, renumbering cleanly', async () => {
    const { db: db2, dispose: d2 } = await getTestDb();
    try {
      const first = await createContentBlock(db2, { title: 'First', subtitle: '', body: '' });
      await createContentBlock(db2, { title: 'Second', subtitle: '', body: '' });
      await createContentBlock(db2, { title: 'Third', subtitle: '', body: '' });
      await moveContentBlock(db2, first, 'down');
      expect((await listAllContentBlocks(db2)).map((r) => r.title)).toEqual(['Second', 'First', 'Third']);
      await moveContentBlock(db2, first, 'up');
      expect((await listAllContentBlocks(db2)).map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
      // no-op past the top:
      await moveContentBlock(db2, first, 'up');
      expect((await listAllContentBlocks(db2)).map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
    } finally {
      await d2();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
export type AdminContentBlock = {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  sort_order: number;
};

export async function listAllContentBlocks(db: D1Database): Promise<AdminContentBlock[]> {
  const { results } = await db
    .prepare('SELECT id, title, subtitle, body, sort_order FROM content_blocks WHERE deleted_at IS NULL ORDER BY sort_order, id')
    .all<AdminContentBlock>();
  return results;
}

export async function createContentBlock(
  db: D1Database,
  v: { title: string; subtitle: string; body: string },
): Promise<number> {
  const max = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM content_blocks WHERE deleted_at IS NULL')
    .first<{ m: number }>();
  const res = await db
    .prepare('INSERT INTO content_blocks (title, subtitle, body, sort_order) VALUES (?, ?, ?, ?)')
    .bind(v.title, v.subtitle, v.body, (max?.m ?? 0) + 1)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateContentBlock(
  db: D1Database,
  id: number,
  v: { title: string; subtitle: string; body: string },
): Promise<void> {
  await db
    .prepare('UPDATE content_blocks SET title = ?, subtitle = ?, body = ? WHERE id = ?')
    .bind(v.title, v.subtitle, v.body, id)
    .run();
}

export async function softDeleteContentBlock(db: D1Database, id: number, iso: string): Promise<void> {
  await db.prepare('UPDATE content_blocks SET deleted_at = ? WHERE id = ?').bind(iso, id).run();
}

export async function restoreContentBlock(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE content_blocks SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export async function moveContentBlock(db: D1Database, id: number, dir: 'up' | 'down'): Promise<void> {
  const rows = await listAllContentBlocks(db);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.batch(
    rows.map((r, idx) =>
      db.prepare('UPDATE content_blocks SET sort_order = ? WHERE id = ?').bind(idx + 1, r.id),
    ),
  );
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/db.ts tests/db-content.test.ts
git commit -m "feat: content-block admin db helpers (crud, soft delete, reorder)"
```

---

### Task 5: Pickup-day admin db helpers (TDD)

**Files:**
- Modify: `src/lib/db.ts` (append)
- Test: `tests/db-pickup.test.ts`

**Interfaces:**
- Consumes: `getTestDb`.
- Produces (mirrors Task 4 for `pickup_days`):
  - `type AdminPickupDay = { id: number; date_text: string; description: string; sort_order: number }`
  - `listAllPickupDays(db): Promise<AdminPickupDay[]>`
  - `createPickupDay(db, v: { date_text: string; description: string }): Promise<number>`
  - `updatePickupDay(db, id, v: { date_text: string; description: string }): Promise<void>`
  - `softDeletePickupDay(db, id, iso): Promise<void>` / `restorePickupDay(db, id): Promise<void>`
  - `movePickupDay(db, id, dir: 'up' | 'down'): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`tests/db-pickup.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  listAllPickupDays, createPickupDay, updatePickupDay,
  softDeletePickupDay, restorePickupDay, movePickupDay,
} from '../src/lib/db';

describe('pickup day admin helpers', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates, lists, updates, soft-deletes, restores, and moves', async () => {
    const a = await createPickupDay(db, { date_text: 'Mon Dec 1', description: 'Lancaster' });
    const b = await createPickupDay(db, { date_text: 'Tue Dec 2', description: 'Platteville' });
    expect((await listAllPickupDays(db)).map((r) => r.date_text)).toEqual(['Mon Dec 1', 'Tue Dec 2']);

    await updatePickupDay(db, a, { date_text: 'Mon Dec 1st', description: 'Lancaster 11-2:30' });
    expect((await listAllPickupDays(db)).find((r) => r.id === a)!.description).toBe('Lancaster 11-2:30');

    await movePickupDay(db, a, 'down');
    expect((await listAllPickupDays(db)).map((r) => r.id)).toEqual([b, a]);

    await softDeletePickupDay(db, b, '2026-10-05T00:00:00Z');
    expect((await listAllPickupDays(db)).some((r) => r.id === b)).toBe(false);
    await restorePickupDay(db, b);
    expect((await listAllPickupDays(db)).some((r) => r.id === b)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
export type AdminPickupDay = {
  id: number;
  date_text: string;
  description: string;
  sort_order: number;
};

export async function listAllPickupDays(db: D1Database): Promise<AdminPickupDay[]> {
  const { results } = await db
    .prepare('SELECT id, date_text, description, sort_order FROM pickup_days WHERE deleted_at IS NULL ORDER BY sort_order, id')
    .all<AdminPickupDay>();
  return results;
}

export async function createPickupDay(
  db: D1Database,
  v: { date_text: string; description: string },
): Promise<number> {
  const max = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM pickup_days WHERE deleted_at IS NULL')
    .first<{ m: number }>();
  const res = await db
    .prepare('INSERT INTO pickup_days (date_text, description, sort_order) VALUES (?, ?, ?)')
    .bind(v.date_text, v.description, (max?.m ?? 0) + 1)
    .run();
  return res.meta.last_row_id as number;
}

export async function updatePickupDay(
  db: D1Database,
  id: number,
  v: { date_text: string; description: string },
): Promise<void> {
  await db
    .prepare('UPDATE pickup_days SET date_text = ?, description = ? WHERE id = ?')
    .bind(v.date_text, v.description, id)
    .run();
}

export async function softDeletePickupDay(db: D1Database, id: number, iso: string): Promise<void> {
  await db.prepare('UPDATE pickup_days SET deleted_at = ? WHERE id = ?').bind(iso, id).run();
}

export async function restorePickupDay(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE pickup_days SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export async function movePickupDay(db: D1Database, id: number, dir: 'up' | 'down'): Promise<void> {
  const rows = await listAllPickupDays(db);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.batch(
    rows.map((r, idx) =>
      db.prepare('UPDATE pickup_days SET sort_order = ? WHERE id = ?').bind(idx + 1, r.id),
    ),
  );
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/db.ts tests/db-pickup.test.ts
git commit -m "feat: pickup-day admin db helpers (crud, soft delete, reorder)"
```

---

### Task 6: Applications-open toggle

**Files:**
- Create: `src/pages/admin/settings/applications-open.ts`
- Modify: `src/components/admin/AdminHome.astro`, `src/pages/admin/index.astro`

**Interfaces:**
- Consumes: `getSettings`, `setApplicationsOpen`; CSRF helpers.
- Produces: `POST /admin/settings/applications-open` (CSRF-checked; flips the flag; 303 → `/admin`). AdminHome's status card becomes a real toggle form; the `/admin` index page passes a `csrfToken` prop to `AdminHome`.

- [ ] **Step 1: Write the toggle endpoint**

`src/pages/admin/settings/applications-open.ts`:

```ts
import type { APIRoute } from 'astro';
import { getSettings, setApplicationsOpen } from '../../../lib/db';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies, redirect }) => {
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  if (ok) {
    const current = await getSettings(locals.runtime.env.DB);
    await setApplicationsOpen(locals.runtime.env.DB, current.applications_open !== 1);
  }
  return redirect('/admin', 303);
};
```

- [ ] **Step 2: Mint + pass a CSRF token from the index page**

In `src/pages/admin/index.astro`, the signed-out branch already mints a `csrf` cookie/token. Make that block run for BOTH states so the signed-in home can use it. Ensure the frontmatter computes `cookieValue`/`csrfToken` unconditionally (move the mint above the `signedInEmail` render), and change the signed-in render to:

```astro
{signedInEmail ? (
  <AdminHome email={signedInEmail} csrfToken={csrfToken} />
) : (
```

(If the mint currently sits only inside the signed-out branch, relocate the three lines — `const cookieExisting`, `const cookieValue`, the `Astro.cookies.set('csrf', …)` — plus `const csrfToken = await csrfTokenFor(...)` to run before the `---` closes, so both branches see `csrfToken`.)

- [ ] **Step 3: Replace AdminHome's read-only status card with a toggle**

In `src/components/admin/AdminHome.astro`, add `csrfToken: string` to `Props`, and replace the status-card block with:

```astro
      <div class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
        <p class="text-xl font-bold">Applications are {open ? 'OPEN' : 'CLOSED'} right now.</p>
        <p class="mt-1 text-lg text-stone-700">
          {open
            ? 'Families can apply online right now.'
            : 'The online application form is closed. Families see a message with the phone line and paper application.'}
        </p>
        <form method="post" action="/admin/settings/applications-open" class="mt-3"
          onsubmit={`return confirm('${open ? 'Close applications so families can no longer apply online?' : 'Open applications so families can apply online?'}')`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <button type="submit" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">
            {open ? 'Close applications' : 'Open applications'}
          </button>
        </form>
      </div>
```

Note the `onsubmit` confirm is inline; because AdminHome renders its own bare document (not the Admin layout), it does not load `print-button.js`. To keep the confirm CSP-safe, ALSO add before `</body>` in AdminHome: `<script src="/scripts/print-button.js" defer></script>` and change the `onsubmit=` to a `data-confirm=` attribute on the `<form>` (the shared script already wires `form[data-confirm]`). Final form tag:

```astro
        <form method="post" action="/admin/settings/applications-open" class="mt-3"
          data-confirm={open ? 'Close applications so families can no longer apply online?' : 'Open applications so families can apply online?'}>
```

- [ ] **Step 4: Verify + commit**

Run: `npm run test` (112 green), `npm run build` (Complete!). Live check: sign in (seed a session as in Plan 3a's verification), GET `/admin`, confirm the toggle button and a `csrf_token` hidden field render; POST the toggle with the matching cookie/token and confirm `settings.applications_open` flips. Clean up. Then:

```bash
git add src/pages/admin/settings/applications-open.ts src/components/admin/AdminHome.astro src/pages/admin/index.astro
git commit -m "feat: applications-open toggle on the admin home"
```

---

### Task 7: This year's news & gifts editor

**Files:**
- Create: `src/pages/admin/content/index.astro`, `src/pages/admin/content/[id]/restore.ts`

**Interfaces:**
- Consumes: `listAllContentBlocks`, `createContentBlock`, `updateContentBlock`, `softDeleteContentBlock`, `restoreContentBlock`, `moveContentBlock`; CSRF; `Admin` layout.
- Produces: `/admin/content` GET (list of blocks with inline edit forms, an add form, up/down reorder, delete) and POST (`act` ∈ `create`, `update`, `delete`, `move_up`, `move_down`). Delete redirects with `?undo=<id>`; `restore.ts` is the Undo target. All POSTs CSRF-checked.

- [ ] **Step 1: Write the restore endpoint**

`src/pages/admin/content/[id]/restore.ts`:

```ts
import type { APIRoute } from 'astro';
import { restoreContentBlock } from '../../../../lib/db';
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
  if (ok && Number.isInteger(id)) await restoreContentBlock(locals.runtime.env.DB, id);
  return redirect('/admin/content', 303);
};
```

- [ ] **Step 2: Write the editor page**

`src/pages/admin/content/index.astro`:

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import {
  listAllContentBlocks, createContentBlock, updateContentBlock,
  softDeleteContentBlock, moveContentBlock, type AdminContentBlock,
} from '../../../lib/db';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
let banner = '';

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (okCsrf) {
    const act = String(form.get('act') ?? '');
    const id = Number(form.get('id'));
    const v = {
      title: String(form.get('title') ?? '').trim(),
      subtitle: String(form.get('subtitle') ?? '').trim(),
      body: String(form.get('body') ?? '').trim(),
    };
    if (act === 'create' && v.title !== '') {
      await createContentBlock(env.DB, v);
      banner = 'Added.';
    } else if (act === 'update' && Number.isInteger(id) && v.title !== '') {
      await updateContentBlock(env.DB, id, v);
      banner = 'Saved.';
    } else if (act === 'delete' && Number.isInteger(id)) {
      await softDeleteContentBlock(env.DB, id, new Date().toISOString());
      return Astro.redirect(`/admin/content?undo=${id}`, 303);
    } else if ((act === 'move_up' || act === 'move_down') && Number.isInteger(id)) {
      await moveContentBlock(env.DB, id, act === 'move_up' ? 'up' : 'down');
      banner = 'Moved.';
    } else if (v.title === '' && (act === 'create' || act === 'update')) {
      banner = 'Please give the item a title before saving.';
    }
  }
}

const undoId = new URL(Astro.request.url).searchParams.get('undo');
const blocks = await listAllContentBlocks(env.DB);

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
---
<Admin title="This year's news" heading="This year's news & gifts list" back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">Help: these boxes show on the home page under "This Year's News." Edit one and press Save, or add a new one at the bottom.</p>

  {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}
  {undoId && (
    <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status">
      <form method="post" action={`/admin/content/${undoId}/restore`} class="flex flex-wrap items-center gap-3">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <span class="font-semibold">That item was deleted.</span>
        <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Undo delete</button>
      </form>
    </div>
  )}

  {blocks.map((b: AdminContentBlock, idx: number) => (
    <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
      <form method="post" class="space-y-3">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="id" value={String(b.id)} />
        <label class="block font-semibold">Title<input class={input} type="text" name="title" value={b.title} /></label>
        <label class="block font-semibold">Subtitle<input class={input} type="text" name="subtitle" value={b.subtitle} /></label>
        <label class="block font-semibold">Text<textarea class={input} name="body" rows="4">{b.body}</textarea></label>
        <div class="flex flex-wrap gap-2">
          <button type="submit" name="act" value="update" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save</button>
          <button type="submit" name="act" value="move_up" disabled={idx === 0} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 disabled:opacity-40">Move up</button>
          <button type="submit" name="act" value="move_down" disabled={idx === blocks.length - 1} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 disabled:opacity-40">Move down</button>
          <button type="submit" name="act" value="delete" data-confirm="Delete this item? You'll get an Undo link right after." class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Delete</button>
        </div>
      </form>
    </section>
  ))}

  <section class="mt-8 rounded-lg border-2 border-holly-700 bg-white p-5">
    <h2 class="text-2xl font-bold text-holly-800">Add a new item</h2>
    <form method="post" class="mt-3 space-y-3">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <label class="block font-semibold">Title<input class={input} type="text" name="title" /></label>
      <label class="block font-semibold">Subtitle<input class={input} type="text" name="subtitle" /></label>
      <label class="block font-semibold">Text<textarea class={input} name="body" rows="4"></textarea></label>
      <button type="submit" name="act" value="create" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Add this item</button>
    </form>
  </section>

  <script src="/scripts/print-button.js" defer></script>
</Admin>
```

- [ ] **Step 3: Verify + commit**

Run: `npm run test` (112 green), `npm run build` (Complete!). Live check with a seeded session: GET `/admin/content` renders the seeded blocks (if any) + the add form; POST `act=create` adds one; `act=delete` redirects with `?undo=`. Clean up test rows. Then:

```bash
git add src/pages/admin/content/index.astro "src/pages/admin/content/[id]/restore.ts"
git commit -m "feat: this year's news & gifts editor"
```

---

### Task 8: Pickup schedule editor

**Files:**
- Create: `src/pages/admin/pickup/index.astro`, `src/pages/admin/pickup/[id]/restore.ts`

**Interfaces:**
- Consumes: `getSettings`, `updatePickupText`, `listAllPickupDays`, `createPickupDay`, `updatePickupDay`, `softDeletePickupDay`, `restorePickupDay`, `movePickupDay`; CSRF; `Admin`.
- Produces: `/admin/pickup` GET (a title/intro/footer text form + the list of date/description rows with edit, reorder, delete, and an add form) and POST (`act` ∈ `save_text`, `create`, `update`, `delete`, `move_up`, `move_down`). Delete → `?undo=<id>`; `restore.ts` is the Undo target. All CSRF-checked.

- [ ] **Step 1: Write the restore endpoint**

`src/pages/admin/pickup/[id]/restore.ts`:

```ts
import type { APIRoute } from 'astro';
import { restorePickupDay } from '../../../../lib/db';
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
  if (ok && Number.isInteger(id)) await restorePickupDay(locals.runtime.env.DB, id);
  return redirect('/admin/pickup', 303);
};
```

- [ ] **Step 2: Write the editor page**

`src/pages/admin/pickup/index.astro`:

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import {
  getSettings, updatePickupText, listAllPickupDays, createPickupDay,
  updatePickupDay, softDeletePickupDay, movePickupDay, type AdminPickupDay,
} from '../../../lib/db';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
let banner = '';

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (okCsrf) {
    const act = String(form.get('act') ?? '');
    const id = Number(form.get('id'));
    if (act === 'save_text') {
      await updatePickupText(env.DB, {
        title: String(form.get('title') ?? '').trim(),
        intro: String(form.get('intro') ?? '').trim(),
        footer: String(form.get('footer') ?? '').trim(),
      });
      banner = 'Pickup wording saved.';
    } else if (act === 'create') {
      const d = { date_text: String(form.get('date_text') ?? '').trim(), description: String(form.get('description') ?? '').trim() };
      if (d.date_text !== '') { await createPickupDay(env.DB, d); banner = 'Pickup day added.'; }
      else banner = 'Please enter a date before adding.';
    } else if (act === 'update' && Number.isInteger(id)) {
      await updatePickupDay(env.DB, id, { date_text: String(form.get('date_text') ?? '').trim(), description: String(form.get('description') ?? '').trim() });
      banner = 'Saved.';
    } else if (act === 'delete' && Number.isInteger(id)) {
      await softDeletePickupDay(env.DB, id, new Date().toISOString());
      return Astro.redirect(`/admin/pickup?undo=${id}`, 303);
    } else if ((act === 'move_up' || act === 'move_down') && Number.isInteger(id)) {
      await movePickupDay(env.DB, id, act === 'move_up' ? 'up' : 'down');
      banner = 'Moved.';
    }
  }
}

const undoId = new URL(Astro.request.url).searchParams.get('undo');
const settings = await getSettings(env.DB);
const days = await listAllPickupDays(env.DB);

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3 text-lg';
---
<Admin title="Pickup schedule" heading="Pickup schedule" back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">Help: this is what families see on the Pickup Schedule page. Edit the wording at the top, then add or change the pickup days below.</p>

  {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}
  {undoId && (
    <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status">
      <form method="post" action={`/admin/pickup/${undoId}/restore`} class="flex flex-wrap items-center gap-3">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <span class="font-semibold">That pickup day was deleted.</span>
        <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Undo delete</button>
      </form>
    </div>
  )}

  <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
    <h2 class="text-2xl font-bold text-holly-800">Wording</h2>
    <form method="post" class="mt-3 space-y-3">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <label class="block font-semibold">Title<input class={input} type="text" name="title" value={settings.pickup_title} /></label>
      <label class="block font-semibold">Intro paragraph<textarea class={input} name="intro" rows="3">{settings.pickup_intro}</textarea></label>
      <label class="block font-semibold">Footer note<textarea class={input} name="footer" rows="2">{settings.pickup_footer}</textarea></label>
      <button type="submit" name="act" value="save_text" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save wording</button>
    </form>
  </section>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">Pickup days</h2>
  {days.map((d: AdminPickupDay, idx: number) => (
    <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
      <form method="post" class="space-y-3">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="id" value={String(d.id)} />
        <label class="block font-semibold">Date<input class={input} type="text" name="date_text" value={d.date_text} /></label>
        <label class="block font-semibold">Who picks up / time<textarea class={input} name="description" rows="2">{d.description}</textarea></label>
        <div class="flex flex-wrap gap-2">
          <button type="submit" name="act" value="update" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save</button>
          <button type="submit" name="act" value="move_up" disabled={idx === 0} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 disabled:opacity-40">Move up</button>
          <button type="submit" name="act" value="move_down" disabled={idx === days.length - 1} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 disabled:opacity-40">Move down</button>
          <button type="submit" name="act" value="delete" data-confirm="Delete this pickup day? You'll get an Undo link right after." class="rounded border-2 border-berry-700 px-4 py-2 font-bold text-berry-800">Delete</button>
        </div>
      </form>
    </section>
  ))}

  <section class="mt-6 rounded-lg border-2 border-holly-700 bg-white p-5">
    <h2 class="text-2xl font-bold text-holly-800">Add a pickup day</h2>
    <form method="post" class="mt-3 space-y-3">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <label class="block font-semibold">Date<input class={input} type="text" name="date_text" /></label>
      <label class="block font-semibold">Who picks up / time<textarea class={input} name="description" rows="2"></textarea></label>
      <button type="submit" name="act" value="create" class="rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Add this day</button>
    </form>
  </section>

  <script src="/scripts/print-button.js" defer></script>
</Admin>
```

- [ ] **Step 3: Verify + commit**

Run: `npm run test` (112 green), `npm run build` (Complete!). Live check with a seeded session: GET `/admin/pickup`; POST `act=save_text` updates the settings text; `act=create` adds a day. Clean up. Then:

```bash
git add src/pages/admin/pickup/index.astro "src/pages/admin/pickup/[id]/restore.ts"
git commit -m "feat: pickup schedule editor (wording + days)"
```

---

### Task 9: Paper-application PDF upload

**Files:**
- Create: `src/pages/admin/paper-application/index.astro`

**Interfaces:**
- Consumes: `getSettings`, `setPdfUploadedAt`; CSRF; `FILES` R2 binding; `Admin`.
- Produces: `/admin/paper-application` GET (shows "Currently published: uploaded {date}" + an upload form) and POST (multipart; validates a `.pdf` ≤ 5 MB; `env.FILES.put('application.pdf', bytes)`; records the timestamp; re-renders with a success note). The public `/application.pdf` route already serves the newest object.

- [ ] **Step 1: Write the page**

`src/pages/admin/paper-application/index.astro`:

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import { getSettings, setPdfUploadedAt } from '../../../lib/db';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
let banner = '';
let error = '';

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  const file = form.get('file');
  if (!okCsrf) {
    error = 'Please try again.';
  } else if (!(file instanceof File) || file.size === 0) {
    error = 'Please choose a PDF file to upload.';
  } else if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error = 'That file is not a PDF. Please upload a PDF.';
  } else if (file.size > 5_000_000) {
    error = 'That file is too big (over 5 MB). Please upload a smaller PDF.';
  } else {
    await env.FILES.put('application.pdf', await file.arrayBuffer(), {
      httpMetadata: { contentType: 'application/pdf' },
    });
    await setPdfUploadedAt(env.DB, new Date().toISOString());
    banner = 'Uploaded. The new paper application is now published.';
  }
}

const settings = await getSettings(env.DB);
const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const uploaded = settings.pdf_uploaded_at ? settings.pdf_uploaded_at.slice(0, 10) : null;
---
<Admin title="Paper application" heading="Paper application (PDF)" back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">Help: this is the printable application families download. Upload a new PDF here to replace it.</p>

  {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner}</p></div>}
  {error && <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4" role="alert"><p class="font-bold text-berry-800">{error}</p></div>}

  <p class="mt-6 text-lg">
    {uploaded
      ? <>Currently published: uploaded <strong>{uploaded}</strong>. <a href="/application.pdf" target="_blank" class="font-semibold text-berry-700 underline">View it</a>.</>
      : <>No paper application has been uploaded yet.</>}
  </p>

  <form method="post" enctype="multipart/form-data" class="mt-6 rounded-lg border-2 border-holly-700 bg-white p-5">
    <input type="hidden" name="csrf_token" value={csrfToken} />
    <label class="block text-lg font-semibold">Choose a PDF file
      <input type="file" name="file" accept="application/pdf,.pdf" class="mt-2 block w-full text-lg" />
    </label>
    <button type="submit" class="mt-4 rounded-lg bg-holly-700 px-5 py-3 text-lg font-bold text-white hover:bg-holly-900">Upload and publish</button>
  </form>
</Admin>
```

- [ ] **Step 2: Verify + commit**

Run: `npm run test` (112 green), `npm run build` (Complete!). Live check with a seeded session: GET `/admin/paper-application`; POST a small PDF (`curl -F` with the CSRF cookie/token) and confirm `settings.pdf_uploaded_at` is set and `/application.pdf` serves the new bytes. Reset local R2/state as needed. Then:

```bash
git add src/pages/admin/paper-application/index.astro
git commit -m "feat: paper-application PDF upload"
```

---

### Task 10: Wire the new sections into the admin nav and home

**Files:**
- Modify: `src/layouts/Admin.astro` (the `sections` list), `src/components/admin/AdminHome.astro` (section cards)

**Interfaces:**
- Consumes: nothing new.
- Produces: the Admin layout nav and the home hub link to the sections this plan shipped (Applications, This year's news, Pickup schedule, Paper application). No dead links.

- [ ] **Step 1: Extend the layout nav**

In `src/layouts/Admin.astro`, replace the `sections` array with:

```ts
const sections = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/applications', label: 'Applications this year' },
  { href: '/admin/content', label: "This year's news" },
  { href: '/admin/pickup', label: 'Pickup schedule' },
  { href: '/admin/paper-application', label: 'Paper application' },
];
```

- [ ] **Step 2: Add home cards**

In `src/components/admin/AdminHome.astro`, replace the single Applications card grid with:

```astro
      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <a href="/admin/applications" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Applications this year</span>
          <span class="mt-1 block text-lg text-stone-700">Review, approve, print pickup slips, and download the list for Excel.</span>
        </a>
        <a href="/admin/content" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">This year's news & gifts list</span>
          <span class="mt-1 block text-lg text-stone-700">Edit what families see on the home page.</span>
        </a>
        <a href="/admin/pickup" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Pickup schedule</span>
          <span class="mt-1 block text-lg text-stone-700">Set the pickup days, times, and towns.</span>
        </a>
        <a href="/admin/paper-application" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Paper application</span>
          <span class="mt-1 block text-lg text-stone-700">Upload a new printable PDF application.</span>
        </a>
      </div>
```

Remove the old "More sections … are coming soon." paragraph.

- [ ] **Step 3: Verify + commit**

Run: `npm run test` (112 green), `npm run build` (Complete!). Live: sign in, confirm the nav and home cards link to `/admin/content`, `/admin/pickup`, `/admin/paper-application` (all now exist) with no 404s. Then:

```bash
git add src/layouts/Admin.astro src/components/admin/AdminHome.astro
git commit -m "feat: link the new admin sections in nav and home"
```

---

### Task 11: Apostrophe sweep of the application validator (carried decision)

**Files:**
- Modify: `src/lib/validation/application.ts`

**Interfaces:**
- Consumes/produces: nothing changes at the interface level — only the literal apostrophe glyphs in user-facing error strings change from typographic (’) to straight ('), per the standing typography decision in `docs/decisions.md`. Tests assert on substrings that don't include the apostrophe, so they stay green.

- [ ] **Step 1: Find the offending strings**

Run: `grep -n "’" src/lib/validation/application.ts`
Expected: a handful of matches (e.g. "it's right", "That's a little long", "employer's name", "You've checked", "don't receive", "person's", "they're").

- [ ] **Step 2: Replace every typographic apostrophe with a straight one**

Edit `src/lib/validation/application.ts` so each `’` inside a string literal becomes `'`. Change ONLY the apostrophe character inside message strings — no other characters, no delimiters, no logic. After editing:

Run: `grep -c "’" src/lib/validation/application.ts`
Expected: `0`.

- [ ] **Step 3: Verify tests + typecheck, then commit**

Run: `npm run test` — Expected: all 112 PASS (assertions use apostrophe-free substrings).
Run: `npx tsc --noEmit` — Expected: clean.

```bash
git add src/lib/validation/application.ts
git commit -m "style: straight apostrophes in application validation messages"
```

---

### Task 12: README admin-login note fix + exit verification

**Files:**
- Modify: `README.md`

**Interfaces:** docs-only; verifies the exit state.

- [ ] **Step 1: Fix the unfollowable dev-login instruction**

In `README.md`, under "Working on the admin console", the "read the link from the dev server log" approach does not work (the link is never logged; only the token hash is stored). Replace the numbered list under that heading with the two working approaches:

```markdown
Sign-in needs an allow-listed email and a session. Two working ways to get in locally:

1. **Mint a token directly, then click through the interstitial.** Insert an allow-listed
   email, then insert a login token with a known raw value and open the verify link:

       npx wrangler d1 execute gchp --local --command "INSERT OR IGNORE INTO admin_emails (email) VALUES ('you@example.com')"

   Generate a random token, store its SHA-256 hash in `login_tokens` (with a far-future
   `expires_at`), then open `http://localhost:4321/admin/verify?token=<raw>` and click
   "Sign me in". (The raw token is what you put in the URL; only its hash is stored.)

2. **Create a session row directly** (fastest for iterating on admin pages): generate a
   random id, store its SHA-256 hash in `sessions` with a far-future `expires_at`, and send
   the raw id as the `admin_session` cookie on your requests.

Editors live at `/admin/content`, `/admin/pickup`, and `/admin/paper-application`. Content
and pickup rows soft-delete (Undo appears right after); the applications-open toggle is on
the admin home. Test rows in the applications tables must be deleted children-first
(`household_members`, `employers`, then `applications`).
```

- [ ] **Step 2: Full verification**

Run: `npm run test` — Expected: all pass (Plan 3a's 112 + the settings/content/pickup tests added here), pristine output.
Run: `npm run build` — Expected: Complete!.
Run: `npx tsc --noEmit` — Expected: clean.

Spot-check the exit criteria below; anything failing goes back to its task.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: correct admin local-login instructions and note the new editors"
```

---

## Plan 3b exit criteria

- Suite, build, and typecheck green.
- **Login hardening:** the magic-link is single-use and atomic (racing consumers → one winner); `/admin/verify` GET shows a "Sign me in" button and does NOT consume the token; POST consumes and signs in. An email link-scanner's GET can no longer burn the operator's link.
- **Applications-open toggle:** a confirm-guarded button on the admin home flips `settings.applications_open`; when closed the public `/apply` shows the closed message (Plan 2 behavior).
- **News & gifts editor** (`/admin/content`): list, add, edit, reorder (up/down), soft-delete with Undo — all CSRF-checked, JS-optional, ≥18px, one `<h1>`, Back, Help.
- **Pickup schedule editor** (`/admin/pickup`): edit the title/intro/footer wording and add/edit/reorder/soft-delete pickup days with Undo.
- **Paper-application upload** (`/admin/paper-application`): upload a PDF (≤5 MB, PDF-only) to R2 and record the timestamp; `/application.pdf` serves the newest; shows "Currently published: uploaded {date}".
- **Nav + home** link only to shipped sections (no dead links); apostrophe sweep done (zero `’` in the validator); README login instructions actually work.
- **Not in this plan (Plan 3c):** donors + donations, contact-messages screen, member/employer/benefit-level application editing, and the applications-workflow polish carried in docs/decisions.md (approve/deny PRG + banners, undo/restore banner on the applications list, CSRF-failure banners on the detail/edit pages, PU single-statement assignment, LIKE-wildcard escaping in the applications search, edit-form required-field/bags feedback, the fuller Excel export column set + honoring `q`).
