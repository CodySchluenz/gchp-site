# Plan 3a: Admin Console — Auth + Applications Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the operator a working, secure `/admin`: passwordless magic-link login, and the full applications workflow — list, review, approve/deny with emails, assign pickup numbers, edit, delete/undo, print pickup slips, and download the list for Excel.

**Architecture:** Auth and data rules live in pure/integration-tested modules (`src/lib/auth.ts`, `src/lib/csv.ts`, new `src/lib/db.ts` helpers, `src/lib/email/render.ts` templates). A middleware gate protects every `/admin` route except the sign-in and verify entry points. Admin pages are thin Astro server pages using a plain, calm `Admin` layout; print views bypass the layout. This is Plan 3a of the admin console; Plan 3b adds content/pickup/donor/message editing and PDF upload.

**Tech Stack:** unchanged — Astro 5 + @astrojs/cloudflare, Tailwind 4, D1, Resend via fetch, Vitest, wrangler (its `getPlatformProxy` powers integration tests). No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-gchp-site-design.md` — §5 (admin console), §6 (auth), §7 (security), §8 (emails #2 approved, #3 denied, #4 sign-in). It governs on conflict.
- **No new dependencies.** Runtime: `astro`, `@astrojs/cloudflare`, `tailwindcss`, `@tailwindcss/vite`. Dev: `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`.
- **Admin usability (spec §5, non-negotiable):** every admin screen has base text ≥ 18px, high contrast, plain English (say "Download list for Excel", "Applications this year"), text labels on every button (never icon-only), one clear primary action, an obvious **Back**, a one-sentence **Help** note. Confirmation before anything destructive; soft-delete with a visible **Undo**. Light festive touch, otherwise calm and plain.
- **Auth (spec §6):** magic-link only, no passwords. Allow-list is the `admin_emails` table (seeded `skleinow@co.grant.wi.gov`, `codydps@gmail.com`). Login token: random ≥256-bit, stored **hashed**, single-use, 15-minute expiry. Session: random id in an HttpOnly + Secure + SameSite=Lax cookie named `admin_session`, stored **hashed**, 30-day expiry renewed on use. Sign-in page always responds "if that address is on our list, the link is on its way" (no address disclosure). Login endpoint is rate-limited.
- **Security (spec §7):** no applicant PII in logs, URLs, or email subject lines. All D1 access via prepared statements with `.bind()`. CSRF token on every state-changing admin form. `/admin` responses `Cache-Control: no-store` (already set by middleware). Secrets only in env.
- **Season logic (spec §2/§7):** "current season" = `new Date().getFullYear()` (workerd is UTC). Data kept indefinitely (owner decision) — there is NO purge; the list defaults to the current season and a "Previous years" control reaches older ones.
- **Binding notes from earlier plans (docs/decisions.md):** straight apostrophes (') in all code-authored copy — do not introduce typographic ones (’); `household_members`/`employers` have no `deleted_at`, so the delete workflow gates children through the parent's `deleted_at`; the test harness currently applies only `migrations/0001_init.sql` — this plan adds no migration, so no harness change is needed, but if that changes, upgrade the harness to apply all of `migrations/*.sql`.
- Every admin page: exactly one `<h1>`. Works with JavaScript disabled (admin may use an older laptop). WCAG 2.2 AA.
- TDD for every logic/data module (Tasks 1, 2, 3, 7, 8, 10, 12, 13, 14 have tests). Run the full suite before each commit. Plan 2's suite has **79 tests**; every task keeps prior tests green.
- Node ≥ 22; repo root is the project root; Git Bash on Windows. Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Existing interfaces consumed (exact)

- `src/lib/csrf.ts`: `newCsrfCookieValue(): string`, `csrfTokenFor(secret, cookieValue): Promise<string>`, `verifyCsrf(secret, cookieValue, token): Promise<boolean>`.
- `src/lib/rate-limit.ts`: `allowRequest(store, key, limit, windowMs, now): Promise<boolean>`, `D1RateStore(db)`.
- `src/lib/email/render.ts`: `escapeHtml(s)`, `emailShell(title, bodyHtml)`, `type RenderedEmail`. `src/lib/email/send.ts`: `sendEmail(env, to, email, replyTo?): Promise<{sent:true}|{sent:false;error:string}>`.
- `src/lib/db.ts` existing: `getSettings`, `listCities` (`type City = { id: number; name: string }`), plus content/pickup/contact/application helpers. **Append** new helpers; never edit existing exports.
- `src/lib/validation/application.ts`: field-name conventions and `parseMoney`/`parseIntInRange` (reused by the admin edit form).
- `tests/helpers/d1.ts`: `getTestDb(): Promise<{ db: D1Database; dispose }>` — fresh local D1 with schema + seed city 13 + settings row. **Also seeds `admin_emails`? No** — the harness seeds only city + settings. Auth tests insert their own `admin_emails` rows.
- `src/env.d.ts`: `Env` (DB, FILES, RESEND_API_KEY, CSRF_SECRET, EMAIL_FROM, EMAIL_REPLY_TO, CONTACT_TO); `App.Locals.runtime`.
- `src/middleware.ts`: sets security headers + `/admin` no-store. This plan extends it with the auth gate.
- Schema (`migrations/0001_init.sql`): `applications`, `household_members`, `employers`, `admin_emails`, `login_tokens`, `sessions`, `cities`, `rate_limits` — columns exactly as spec §2.

---

### Task 1: Auth primitives — hashing, tokens, session ids (TDD)

**Files:**
- Create: `src/lib/auth-crypto.ts`
- Test: `tests/auth-crypto.test.ts`

**Interfaces:**
- Consumes: Web Crypto (global).
- Produces:
  - `newSecret(): string` — 64-char random hex (32 bytes). Used for both login tokens and session ids.
  - `sha256Hex(value: string): Promise<string>` — 64-char hex digest.

- [ ] **Step 1: Write the failing tests**

`tests/auth-crypto.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newSecret, sha256Hex } from '../src/lib/auth-crypto';

describe('newSecret', () => {
  it('is 64 hex chars and unique per call', () => {
    const a = newSecret();
    const b = newSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('sha256Hex', () => {
  it('produces the known digest for a known input', async () => {
    // SHA-256("abc")
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('is deterministic and differs for different inputs', async () => {
    expect(await sha256Hex('x')).toBe(await sha256Hex('x'));
    expect(await sha256Hex('x')).not.toBe(await sha256Hex('y'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/auth-crypto'`.

- [ ] **Step 3: Implement**

`src/lib/auth-crypto.ts`:

```ts
// Random secrets and SHA-256 hashing for magic-link tokens and sessions.
// Secrets travel to the user (token in the link, session id in the cookie);
// only their hashes are ever stored, so a database read cannot mint a login.

const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return toHex(new Uint8Array(digest));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-crypto.ts tests/auth-crypto.test.ts
git commit -m "feat: auth crypto primitives (random secrets, sha-256)"
```

---

### Task 2: Auth data layer — allow-list, tokens, sessions (integration TDD)

**Files:**
- Create: `src/lib/auth.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `newSecret`, `sha256Hex` (Task 1); `getTestDb` (tests); tables `admin_emails`, `login_tokens`, `sessions`.
- Produces:
  - `isAllowedEmail(db, email): Promise<boolean>` — case-insensitive, trims.
  - `createLoginToken(db, email, now: number): Promise<string>` — stores `sha256Hex(token)` with `expires_at = now + 15min` (ISO), returns the raw token.
  - `consumeLoginToken(db, rawToken, now: number): Promise<string | null>` — returns the email if the token exists, is unused, and unexpired; marks it used; else null.
  - `createSession(db, email, now: number): Promise<string>` — stores `sha256Hex(id)` with `expires_at = now + 30d`, returns the raw session id.
  - `getSessionEmail(db, rawSessionId, now: number): Promise<string | null>` — returns the email if valid+unexpired, and renews `expires_at = now + 30d`; else null.
  - `deleteSession(db, rawSessionId): Promise<void>`.
  - `SESSION_MS = 30 * 24 * 60 * 60 * 1000`, `TOKEN_MS = 15 * 60 * 1000` (exported consts).

- [ ] **Step 1: Write the failing tests**

`tests/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  isAllowedEmail, createLoginToken, consumeLoginToken,
  createSession, getSessionEmail, deleteSession, TOKEN_MS, SESSION_MS,
} from '../src/lib/auth';

const T0 = 1_000_000_000_000; // fixed base time

describe('auth data layer', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
    await db.prepare("INSERT INTO admin_emails (email) VALUES ('boss@example.com')").run();
  });
  afterAll(async () => { await dispose(); });

  it('recognises allow-listed emails case-insensitively, rejects others', async () => {
    expect(await isAllowedEmail(db, 'boss@example.com')).toBe(true);
    expect(await isAllowedEmail(db, '  BOSS@example.com ')).toBe(true);
    expect(await isAllowedEmail(db, 'nope@example.com')).toBe(false);
  });

  it('consumes a valid login token exactly once and returns the email', async () => {
    const token = await createLoginToken(db, 'boss@example.com', T0);
    expect(await consumeLoginToken(db, token, T0 + 1000)).toBe('boss@example.com');
    expect(await consumeLoginToken(db, token, T0 + 2000)).toBeNull(); // already used
  });

  it('rejects an expired login token', async () => {
    const token = await createLoginToken(db, 'boss@example.com', T0);
    expect(await consumeLoginToken(db, token, T0 + TOKEN_MS + 1)).toBeNull();
  });

  it('rejects an unknown login token', async () => {
    expect(await consumeLoginToken(db, 'deadbeef'.repeat(8), T0)).toBeNull();
  });

  it('creates a session, reads it back, and renews its expiry on use', async () => {
    const id = await createSession(db, 'boss@example.com', T0);
    expect(await getSessionEmail(db, id, T0 + 1000)).toBe('boss@example.com');
    // near-expiry read still valid and renews:
    expect(await getSessionEmail(db, id, T0 + SESSION_MS - 10)).toBe('boss@example.com');
    // after renewal, a time that would have been expired under the ORIGINAL expiry is still valid:
    expect(await getSessionEmail(db, id, T0 + SESSION_MS + 1000)).toBe('boss@example.com');
  });

  it('rejects an expired (unrenewed) session and an unknown session', async () => {
    const id = await createSession(db, 'boss@example.com', T0);
    expect(await getSessionEmail(db, id, T0 + SESSION_MS + 1)).toBeNull();
    expect(await getSessionEmail(db, 'nope'.repeat(16), T0)).toBeNull();
  });

  it('deletes a session (sign out)', async () => {
    const id = await createSession(db, 'boss@example.com', T0);
    await deleteSession(db, id);
    expect(await getSessionEmail(db, id, T0 + 1000)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/auth'`.

- [ ] **Step 3: Implement**

`src/lib/auth.ts`:

```ts
import { newSecret, sha256Hex } from './auth-crypto';

export const TOKEN_MS = 15 * 60 * 1000;
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const iso = (ms: number) => new Date(ms).toISOString();

export async function isAllowedEmail(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM admin_emails WHERE lower(email) = lower(?)')
    .bind(email.trim())
    .first<{ ok: number }>();
  return row !== null;
}

export async function createLoginToken(db: D1Database, email: string, now: number): Promise<string> {
  const token = newSecret();
  await db
    .prepare('INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), email.trim(), iso(now + TOKEN_MS))
    .run();
  return token;
}

export async function consumeLoginToken(
  db: D1Database,
  rawToken: string,
  now: number,
): Promise<string | null> {
  const hash = await sha256Hex(rawToken);
  const row = await db
    .prepare('SELECT email, expires_at, used_at FROM login_tokens WHERE token_hash = ?')
    .bind(hash)
    .first<{ email: string; expires_at: string; used_at: string | null }>();
  if (!row || row.used_at !== null || Date.parse(row.expires_at) < now) return null;
  await db
    .prepare('UPDATE login_tokens SET used_at = ? WHERE token_hash = ?')
    .bind(iso(now), hash)
    .run();
  return row.email;
}

export async function createSession(db: D1Database, email: string, now: number): Promise<string> {
  const id = newSecret();
  await db
    .prepare('INSERT INTO sessions (session_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(id), email.trim(), iso(now), iso(now + SESSION_MS))
    .run();
  return id;
}

export async function getSessionEmail(
  db: D1Database,
  rawSessionId: string,
  now: number,
): Promise<string | null> {
  const hash = await sha256Hex(rawSessionId);
  const row = await db
    .prepare('SELECT email, expires_at FROM sessions WHERE session_hash = ?')
    .bind(hash)
    .first<{ email: string; expires_at: string }>();
  if (!row || Date.parse(row.expires_at) < now) return null;
  await db
    .prepare('UPDATE sessions SET expires_at = ? WHERE session_hash = ?')
    .bind(iso(now + SESSION_MS), hash)
    .run();
  return row.email;
}

export async function deleteSession(db: D1Database, rawSessionId: string): Promise<void> {
  await db
    .prepare('DELETE FROM sessions WHERE session_hash = ?')
    .bind(await sha256Hex(rawSessionId))
    .run();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/auth.test.ts
git commit -m "feat: auth data layer - allow-list, login tokens, sessions"
```

---

### Task 3: Admin email templates — sign-in, approved, denied (TDD)

**Files:**
- Modify: `src/lib/email/render.ts` (append three functions)
- Test: `tests/email-admin.test.ts`

**Interfaces:**
- Consumes: `emailShell`, `escapeHtml`, `RenderedEmail`.
- Produces:
  - `renderSignInEmail(link: string): RenderedEmail` — subject "Your Grant County Holiday Project sign-in link"; body has the clickable link and a "expires in 15 minutes" note; link appears raw in both html and text.
  - `renderApprovedEmail(firstName: string): RenderedEmail` — subject "Your Holiday Project application was approved"; body: approved, watch for your pickup slip with your December pickup date, phone line.
  - `renderDeniedEmail(firstName: string): RenderedEmail` — subject "An update on your Holiday Project application"; kind wording; invites a call to the phone line with questions. Subjects contain no PII.

- [ ] **Step 1: Write the failing tests**

`tests/email-admin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderSignInEmail, renderApprovedEmail, renderDeniedEmail } from '../src/lib/email/render';

describe('renderSignInEmail', () => {
  it('has a PII-free subject and includes the link and expiry', () => {
    const r = renderSignInEmail('https://example.org/admin/verify?token=abc');
    expect(r.subject).toBe('Your Grant County Holiday Project sign-in link');
    expect(r.html).toContain('https://example.org/admin/verify?token=abc');
    expect(r.text).toContain('https://example.org/admin/verify?token=abc');
    expect(r.html).toContain('15 minutes');
  });
});

describe('renderApprovedEmail', () => {
  it('greets by escaped name, mentions the pickup slip, PII-free subject', () => {
    const r = renderApprovedEmail('<Sue>');
    expect(r.subject).toBe('Your Holiday Project application was approved');
    expect(r.subject).not.toContain('Sue');
    expect(r.html).toContain('&lt;Sue&gt;');
    expect(r.html).toContain('pickup slip');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});

describe('renderDeniedEmail', () => {
  it('is kind, PII-free subject, invites a phone call', () => {
    const r = renderDeniedEmail('Sue');
    expect(r.subject).toBe('An update on your Holiday Project application');
    expect(r.subject).not.toContain('Sue');
    expect(r.html).toContain('608-723-2136 ext 1194');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — the three functions are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/email/render.ts`:

```ts
export function renderSignInEmail(link: string): RenderedEmail {
  const subject = 'Your Grant County Holiday Project sign-in link';
  const text = `Here is your sign-in link for the Grant County Holiday Project admin:

${link}

Click it to sign in. For your security, this link expires in 15 minutes and
can be used once. If you did not ask to sign in, you can ignore this email.`;
  const html = emailShell(
    'Your sign-in link',
    `<p>Here is your sign-in link for the Grant County Holiday Project admin:</p>
     <p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
     <p>Click it to sign in. For your security, this link expires in
        <strong>15 minutes</strong> and can be used once. If you did not ask to
        sign in, you can ignore this email.</p>`,
  );
  return { subject, html, text };
}

export function renderApprovedEmail(firstName: string): RenderedEmail {
  const subject = 'Your Holiday Project application was approved';
  const text = `Hello ${firstName},

Good news - your Grant County Holiday Project application has been approved.

Watch your mail and email for your pickup slip, which will have your pickup
date in December. Please bring your pickup slip with you.

Questions? Call our message line at 608-723-2136 ext 1194 and leave your name
and phone number.`;
  const html = emailShell(
    'Your application was approved',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>Good news - your Grant County Holiday Project application has been
        <strong>approved</strong>.</p>
     <p>Watch your mail and email for your <strong>pickup slip</strong>, which
        will have your pickup date in December. Please bring your pickup slip
        with you.</p>
     <p>Questions? Call our message line at <strong>608-723-2136 ext 1194</strong>
        and leave your name and phone number.</p>`,
  );
  return { subject, html, text };
}

export function renderDeniedEmail(firstName: string): RenderedEmail {
  const subject = 'An update on your Holiday Project application';
  const text = `Hello ${firstName},

Thank you for applying to the Grant County Holiday Project. After review, we
are not able to approve your application this season.

We know this is hard to hear. If you have questions, or think there may have
been a mistake, please call our message line at 608-723-2136 ext 1194 and
leave your name and phone number - we are glad to talk with you.`;
  const html = emailShell(
    'An update on your application',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>Thank you for applying to the Grant County Holiday Project. After
        review, we are not able to approve your application this season.</p>
     <p>We know this is hard to hear. If you have questions, or think there may
        have been a mistake, please call our message line at
        <strong>608-723-2136 ext 1194</strong> and leave your name and phone
        number - we are glad to talk with you.</p>`,
  );
  return { subject, html, text };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/render.ts tests/email-admin.test.ts
git commit -m "feat: admin email templates - sign-in, approved, denied"
```

---

### Task 4: Auth gate middleware + Admin layout

**Files:**
- Modify: `src/middleware.ts`, `src/env.d.ts`
- Create: `src/layouts/Admin.astro`

**Interfaces:**
- Consumes: `getSessionEmail` (Task 2).
- Produces: middleware that, for any `/admin` path other than the sign-in/verify entry points, requires a valid `admin_session` cookie and otherwise 303-redirects to `/admin`; on success it stashes `locals.adminEmail`. `App.Locals.adminEmail: string | undefined` added to `env.d.ts`. `<Admin title="..." heading="..." back?={{href,label}}>` layout: plain calm chrome, 18px+ base, a festive header strip, nav to the admin sections, sign-out form, and a `<slot />`.

- [ ] **Step 1: Extend the middleware**

Replace `src/middleware.ts` with:

```ts
import { defineMiddleware } from 'astro:middleware';
import { getSessionEmail } from './lib/auth';

// Entry points reachable without a session: the sign-in page itself and the
// magic-link verifier. Everything else under /admin requires a live session.
const PUBLIC_ADMIN = new Set(['/admin', '/admin/verify']);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname.replace(/\/$/, '') || '/';

  if (path === '/admin' || path.startsWith('/admin/')) {
    const email = await getSessionEmail(
      context.locals.runtime.env.DB,
      context.cookies.get('admin_session')?.value ?? '',
      Date.now(),
    );
    if (email) context.locals.adminEmail = email;
    if (!email && !PUBLIC_ADMIN.has(path)) {
      return context.redirect('/admin', 303);
    }
  }

  const res = context.url.pathname === '/_image' ? new Response('Not found', { status: 404 }) : await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self' https://www.paypal.com; frame-ancestors 'none'; base-uri 'self'",
  );
  if (path === '/admin' || path.startsWith('/admin/')) {
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
});
```

(Note: this preserves the Plan-1 `/_image` 404 and all security headers; it adds the auth gate ahead of them. A redirect Response returned before `next()` skips header-setting, which is fine — it carries no admin content.)

- [ ] **Step 2: Add the locals type**

In `src/env.d.ts`, inside `declare namespace App { interface Locals { ... } }`, add the `adminEmail` field so it reads:

```ts
declare namespace App {
  interface Locals {
    runtime: { env: Env };
    adminEmail?: string;
  }
}
```

- [ ] **Step 3: Write the Admin layout**

`src/layouts/Admin.astro`:

```astro
---
interface Props {
  title: string;
  heading: string;
  back?: { href: string; label: string };
}
const { title, heading, back } = Astro.props;
const sections = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/applications', label: 'Applications this year' },
];
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} — GCHP Admin</title>
  </head>
  <body class="min-h-screen bg-cream text-stone-900 text-lg leading-relaxed">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-holly-900">Skip to main content</a>
    <header class="border-b-4 border-gold-500 bg-holly-800 text-white">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <p class="text-2xl font-bold">Holiday Project — Admin</p>
        <form method="post" action="/admin/signout">
          <button type="submit" class="rounded bg-white px-4 py-2 font-semibold text-holly-900 hover:bg-holly-100">Sign out</button>
        </form>
      </div>
      <nav aria-label="Admin sections" class="bg-holly-700">
        <ul class="mx-auto flex max-w-5xl flex-wrap px-2">
          {sections.map((s) => (
            <li><a href={s.href} class="block px-4 py-3 font-semibold text-white hover:bg-holly-900">{s.label}</a></li>
          ))}
        </ul>
      </nav>
    </header>
    <main id="main" class="mx-auto max-w-5xl px-4 py-8">
      {back && (
        <a href={back.href} class="mb-4 inline-block text-lg font-semibold text-berry-700 underline">&larr; {back.label}</a>
      )}
      <h1 class="text-3xl font-bold text-holly-800">{heading}</h1>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 4: Verify build**

Run: `npm run test` (79 green) and `npm run build` (Complete!).
Expected: both pass. (The gate has no page to guard yet; behavioral checks come in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/env.d.ts src/layouts/Admin.astro
git commit -m "feat: admin auth-gate middleware and admin layout"
```

---

### Task 5: Sign-in page, verify, sign-out

**Files:**
- Create: `src/pages/admin/index.astro`, `src/pages/admin/verify.ts`, `src/pages/admin/signout.ts`

**Interfaces:**
- Consumes: `isAllowedEmail`, `createLoginToken`, `consumeLoginToken`, `createSession`, `deleteSession`, `SESSION_MS` (Task 2); `renderSignInEmail` (Task 3); `sendEmail`; CSRF helpers; `allowRequest`/`D1RateStore`; `getSettings` (unused here but pattern); `locals.adminEmail`.
- Produces: `/admin` GET (signed-in → home hub in Task 6; signed-out → sign-in form), `/admin` POST (send link), `/admin/verify` GET (consume token → set cookie → 303 /admin), `/admin/signout` POST (delete session → 303 /admin). The signed-in home content is added in Task 6; for now the signed-in branch shows a minimal placeholder that Task 6 replaces.

- [ ] **Step 1: Write the sign-in / home page**

`src/pages/admin/index.astro`:

```astro
---
import '../../styles/global.css';
import { isAllowedEmail, createLoginToken } from '../../lib/auth';
import { renderSignInEmail } from '../../lib/email/render';
import { sendEmail } from '../../lib/email/send';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../lib/csrf';
import { allowRequest, D1RateStore } from '../../lib/rate-limit';
import AdminHome from '../../components/admin/AdminHome.astro';
export const prerender = false;

const env = Astro.locals.runtime.env;
const signedInEmail = Astro.locals.adminEmail;

let sent = false;
if (!signedInEmail && Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(
    env.CSRF_SECRET,
    Astro.cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  const email = String(form.get('email') ?? '').trim();
  const ip = Astro.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const okRate = await allowRequest(new D1RateStore(env.DB), `signin:${ip}`, 5, 15 * 60_000, Date.now());
  if (okCsrf && okRate && email !== '' && (await isAllowedEmail(env.DB, email))) {
    const token = await createLoginToken(env.DB, email, Date.now());
    const link = `${new URL(Astro.request.url).origin}/admin/verify?token=${token}`;
    await sendEmail(env, email, renderSignInEmail(link));
  }
  // Always the same response — never reveal whether an address is on the list.
  sent = true;
}

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
---
{signedInEmail ? (
  <AdminHome email={signedInEmail} />
) : (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Sign in — GCHP Admin</title>
    </head>
    <body class="min-h-screen bg-cream text-stone-900 text-lg leading-relaxed">
      <main class="mx-auto max-w-md px-4 py-16">
        <h1 class="text-3xl font-bold text-holly-800">Grant County Holiday Project — Admin</h1>
        {sent ? (
          <div class="mt-6 rounded border-l-4 border-holly-700 bg-white p-5">
            <p class="text-xl font-bold text-holly-800">Check your email</p>
            <p class="mt-2">If that address is on our list, a sign-in link is on its way. It works for 15 minutes.</p>
            <p class="mt-2">Didn't get it? Check your spam folder, or <a href="/admin" class="font-semibold text-berry-700 underline">try again</a>.</p>
          </div>
        ) : (
          <form method="post" class="mt-6 space-y-4">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <label for="email" class="block font-semibold">Type your email address</label>
            <input type="email" id="email" name="email" autocomplete="email" required
              class="w-full rounded border-2 border-stone-400 bg-white p-3" />
            <button type="submit" class="w-full rounded-lg bg-holly-700 px-6 py-3 text-lg font-bold text-white hover:bg-holly-900">
              Email me a sign-in link
            </button>
            <p class="text-base text-stone-700">We'll send a link to your email. Click it and you're signed in for 30 days. There's no password to remember.</p>
          </form>
        )}
      </main>
    </body>
  </html>
)}
```

- [ ] **Step 2: Write the verify endpoint**

`src/pages/admin/verify.ts`:

```ts
import type { APIRoute } from 'astro';
import { consumeLoginToken, createSession, SESSION_MS } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url, cookies, redirect }) => {
  const token = url.searchParams.get('token') ?? '';
  const email = await consumeLoginToken(locals.runtime.env.DB, token, Date.now());
  if (!email) {
    return new Response(
      'That sign-in link has expired or was already used. Please request a fresh one.',
      { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  const sessionId = await createSession(locals.runtime.env.DB, email, Date.now());
  cookies.set('admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
    maxAge: Math.floor(SESSION_MS / 1000),
  });
  return redirect('/admin', 303);
};
```

- [ ] **Step 3: Write the sign-out endpoint**

`src/pages/admin/signout.ts`:

```ts
import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const id = cookies.get('admin_session')?.value ?? '';
  if (id) await deleteSession(locals.runtime.env.DB, id);
  cookies.delete('admin_session', { path: '/' });
  return redirect('/admin', 303);
};
```

- [ ] **Step 4: Write a stub AdminHome so the page compiles (Task 6 replaces it)**

`src/components/admin/AdminHome.astro`:

```astro
---
interface Props { email: string }
const { email } = Astro.props;
---
<html lang="en"><head><meta charset="utf-8" /><title>Admin</title></head>
<body><p>Signed in as {email}. Home coming in the next step.</p></body></html>
```

- [ ] **Step 5: Verify the full magic-link loop against local D1**

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8`. Seed an allow-listed email (the harness DB used by dev is the persisted local one; seed it):

```bash
npx wrangler d1 execute gchp --local --command "INSERT OR IGNORE INTO admin_emails (email) VALUES ('boss@example.com')"
JAR=$(mktemp)
# Signed-out GET shows the form:
curl -s -c "$JAR" http://localhost:4321/admin | grep -o "Email me a sign-in link"   # Expected: match
TOKEN=$(curl -s -c "$JAR" http://localhost:4321/admin | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}')
# POST an allow-listed email — always the same "check your email" page:
curl -s -b "$JAR" --data-urlencode "csrf_token=$TOKEN" --data-urlencode "email=boss@example.com" http://localhost:4321/admin | grep -o "Check your email"   # Expected: match
# POST a NON-allow-listed email — identical response (no disclosure):
TOKEN=$(curl -s -c "$JAR" http://localhost:4321/admin | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}')
curl -s -b "$JAR" --data-urlencode "csrf_token=$TOKEN" --data-urlencode "email=stranger@example.com" http://localhost:4321/admin | grep -o "Check your email"   # Expected: match
# Grab the freshest unused token from D1 and verify it (email send fails on dummy key; the token row is still created):
TOK=$(npx wrangler d1 execute gchp --local --command "SELECT token_hash FROM login_tokens ORDER BY rowid DESC LIMIT 1")
echo "$TOK"   # sanity: a hash row exists
```

Because the raw token only exists in the (failed) email, verify the loop end-to-end instead by minting a token through the code path and reading the redirect: simplest robust check — confirm an unauthenticated protected route redirects, and that a bad token is rejected:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:4321/admin/applications   # Expected: 303 http://localhost:4321/admin
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4321/admin/verify?token=deadbeef"          # Expected: 400
```

Full happy-path session is exercised end-to-end by the integration tests in Task 2 (token→session) plus Task 7's page tests; the dev-server checks above confirm the gate and the no-disclosure behavior. Clean up: `npx wrangler d1 execute gchp --local --command "DELETE FROM login_tokens; DELETE FROM sessions"`. Kill the dev server.

Run `npm run test` (79 green) and `npm run build` (Complete!).

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/index.astro src/pages/admin/verify.ts src/pages/admin/signout.ts src/components/admin/AdminHome.astro
git commit -m "feat: admin sign-in, magic-link verify, sign-out"
```

---

### Task 6: Admin home hub

**Files:**
- Modify: `src/components/admin/AdminHome.astro` (replace the stub)

**Interfaces:**
- Consumes: `getSettings` (for the applications-open status card), `Admin` layout is NOT used here (AdminHome renders its own full document because `/admin` serves both states); reuse the same chrome inline.
- Produces: the signed-in landing: big labeled buttons to the sections this plan ships (**Applications this year** — primary; others shown as "coming soon" placeholders are NOT included — only real links), the applications-open status card with a toggle (the toggle posts to `/admin/applications` season? no — the toggle belongs to settings; **defer the toggle to Plan 3b** and show the status read-only here with a note), and a sign-out button.

- [ ] **Step 1: Replace the stub**

`src/components/admin/AdminHome.astro`:

```astro
---
import { getSettings } from '../../lib/db';
interface Props { email: string }
const { email } = Astro.props;
const settings = await getSettings(Astro.locals.runtime.env.DB);
const open = settings.applications_open === 1;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Home — GCHP Admin</title>
  </head>
  <body class="min-h-screen bg-cream text-stone-900 text-lg leading-relaxed">
    <header class="border-b-4 border-gold-500 bg-holly-800 text-white">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <p class="text-2xl font-bold">Holiday Project — Admin</p>
        <form method="post" action="/admin/signout">
          <button type="submit" class="rounded bg-white px-4 py-2 font-semibold text-holly-900 hover:bg-holly-100">Sign out</button>
        </form>
      </div>
    </header>
    <main id="main" class="mx-auto max-w-5xl px-4 py-8">
      <h1 class="text-3xl font-bold text-holly-800">Welcome</h1>
      <p class="mt-2 text-stone-700">You're signed in as {email}.</p>

      <div class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
        <p class="text-xl font-bold">
          Applications are {open ? 'OPEN' : 'CLOSED'} right now.
        </p>
        <p class="mt-1 text-stone-700">
          {open
            ? 'Families can apply online. You can turn this off from the settings screen (coming soon).'
            : 'The online form is closed. You can turn it on from the settings screen (coming soon).'}
        </p>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <a href="/admin/applications" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Applications this year</span>
          <span class="mt-1 block text-stone-700">Review, approve, print pickup slips, and download the list for Excel.</span>
        </a>
      </div>

      <p class="mt-8 text-base text-stone-600">More sections (news, pickup schedule, donors) are coming soon.</p>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Verify**

Run: `npm run build` — Complete!. Run: `npm run test` — 79 green. (Live signed-in rendering is exercised in Task 7's verification once a real session exists.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminHome.astro
git commit -m "feat: admin home hub"
```

---

### Task 7: db — list applications + seasons (integration TDD)

**Files:**
- Modify: `src/lib/db.ts` (append)
- Test: `tests/db-admin-list.test.ts`

**Interfaces:**
- Consumes: `getTestDb`; `insertApplication`/`NewApplication` (Plan 2, same file) to seed rows.
- Produces:
  - `type ApplicationListRow = { id: number; first_name: string; last_name: string; city_name: string; submitted_at: string; status: string; may_not_be_eligible: number; pu_number: number | null }`
  - `listApplications(db, seasonYear: number, status: 'all' | 'new' | 'approved' | 'denied', search: string): Promise<ApplicationListRow[]>` — excludes soft-deleted; filters by season; by status unless 'all'; case-insensitive name search on first/last (empty search = no name filter); newest first.
  - `listSeasons(db): Promise<number[]>` — distinct non-deleted `season_year` values, descending.

- [ ] **Step 1: Write the failing tests**

`tests/db-admin-list.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, listApplications, listSeasons, type NewApplication } from '../src/lib/db';

function makeApp(over: Partial<NewApplication>): NewApplication {
  return {
    firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13,
    phone: '608', email: 'a@b.co', diabetic: false, permanentlyDisabled: false,
    shareWithSponsor: false, fullTimeResidenceConfirmed: true, yearsReceivedHelp: 0,
    adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
    employers: [],
    benefits: {
      foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '',
      ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '',
      unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '',
    },
    members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
    goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00.000Z',
    mayNotBeEligible: false, householdType: 'family',
    ...over,
  };
}

describe('listApplications / listSeasons', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
    await insertApplication(db, makeApp({ firstName: 'Anna', lastName: 'Adams', submittedAt: '2026-10-01T00:00:00Z' }));
    await insertApplication(db, makeApp({ firstName: 'Bob', lastName: 'Baker', submittedAt: '2026-10-03T00:00:00Z' }));
    const denied = await insertApplication(db, makeApp({ firstName: 'Cy', lastName: 'Carter', submittedAt: '2026-10-02T00:00:00Z' }));
    await db.prepare("UPDATE applications SET status='denied' WHERE id=?").bind(denied).run();
    await insertApplication(db, makeApp({ firstName: 'Old', lastName: 'Timer', seasonYear: 2025, submittedAt: '2025-10-01T00:00:00Z' }));
    const gone = await insertApplication(db, makeApp({ firstName: 'Del', lastName: 'Eted' }));
    await db.prepare("UPDATE applications SET deleted_at='2026-10-05T00:00:00Z' WHERE id=?").bind(gone).run();
  });
  afterAll(async () => { await dispose(); });

  it('lists the current season newest-first, excludes soft-deleted and other seasons', async () => {
    const rows = await listApplications(db, 2026, 'all', '');
    expect(rows.map((r) => r.first_name)).toEqual(['Bob', 'Cy', 'Anna']); // newest submitted first
    expect(rows.every((r) => r.city_name === 'Lancaster')).toBe(true);
  });

  it('filters by status', async () => {
    expect((await listApplications(db, 2026, 'denied', '')).map((r) => r.first_name)).toEqual(['Cy']);
    expect((await listApplications(db, 2026, 'new', '')).map((r) => r.first_name)).toEqual(['Bob', 'Anna']);
  });

  it('searches by name case-insensitively across first and last', async () => {
    expect((await listApplications(db, 2026, 'all', 'baker')).map((r) => r.first_name)).toEqual(['Bob']);
    expect((await listApplications(db, 2026, 'all', 'ANNA')).map((r) => r.first_name)).toEqual(['Anna']);
  });

  it('lists distinct seasons descending, ignoring deleted-only rows', async () => {
    expect(await listSeasons(db)).toEqual([2026, 2025]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `listApplications`/`listSeasons` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
export type ApplicationListRow = {
  id: number;
  first_name: string;
  last_name: string;
  city_name: string;
  submitted_at: string;
  status: string;
  may_not_be_eligible: number;
  pu_number: number | null;
};

export async function listApplications(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
  search: string,
): Promise<ApplicationListRow[]> {
  const like = `%${search.trim().toLowerCase()}%`;
  const cols = `a.id, a.first_name, a.last_name, c.name AS city_name, a.submitted_at,
                a.status, a.may_not_be_eligible, a.pu_number`;
  // The name filter is a no-op when the search box is empty (like === '%%').
  const nameFilter = `(? = '%%' OR lower(a.first_name) LIKE ? OR lower(a.last_name) LIKE ?)`;
  const order = `ORDER BY a.submitted_at DESC, a.id DESC`;

  const stmt =
    status === 'all'
      ? db
          .prepare(
            `SELECT ${cols} FROM applications a JOIN cities c ON c.id = a.city_id
             WHERE a.deleted_at IS NULL AND a.season_year = ? AND ${nameFilter} ${order}`,
          )
          .bind(seasonYear, like, like, like)
      : db
          .prepare(
            `SELECT ${cols} FROM applications a JOIN cities c ON c.id = a.city_id
             WHERE a.deleted_at IS NULL AND a.season_year = ? AND a.status = ? AND ${nameFilter} ${order}`,
          )
          .bind(seasonYear, status, like, like, like);

  const { results } = await stmt.all<ApplicationListRow>();
  return results;
}

export async function listSeasons(db: D1Database): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT season_year FROM applications WHERE deleted_at IS NULL ORDER BY season_year DESC')
    .all<{ season_year: number }>();
  return results.map((r) => r.season_year);
}
```


- [ ] **Step 4: Run to verify it passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-admin-list.test.ts
git commit -m "feat: db helpers to list applications and seasons"
```

---

### Task 8: db — application detail (integration TDD)

**Files:**
- Modify: `src/lib/db.ts` (append)
- Test: `tests/db-admin-detail.test.ts`

**Interfaces:**
- Consumes: `getTestDb`, `insertApplication`.
- Produces:
  - `type ApplicationDetail = { app: Record<string, unknown>; city_name: string; members: Record<string, unknown>[]; employers: Record<string, unknown>[] }` — `app` is the full `applications` row.
  - `getApplicationDetail(db, id): Promise<ApplicationDetail | null>` — null if missing or soft-deleted; members ordered by `position`; employers by `id`.

- [ ] **Step 1: Write the failing test**

`tests/db-admin-detail.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, getApplicationDetail, type NewApplication } from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: true, permanentlyDisabled: false, shareWithSponsor: true, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 2, adoptedLastYear: false, bedChoice: 'blanket', bedSize: 'queen',
  noEmploymentConfirmed: false,
  employers: [{ employerName: 'Acme', workerName: 'Sue', hourlyWage: 15.5, hoursPerWeek: 32 }],
  benefits: { foodShareAmount: 250, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [
    { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 34, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '8', shirtTop: '8', underwear: '', socks: '', diapers: '', gifts: 'legos' },
  ],
  goodDeed: 'shoveled snow', seasonYear: 2026, submittedAt: '2026-10-02T00:00:00Z',
  mayNotBeEligible: false, householdType: 'family',
};

describe('getApplicationDetail', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('returns the full application with city, members, employers', async () => {
    const id = await insertApplication(db, app);
    const d = await getApplicationDetail(db, id);
    expect(d).not.toBeNull();
    expect(d!.city_name).toBe('Lancaster');
    expect(d!.app.first_name).toBe('Sue');
    expect(d!.app.food_share_amount).toBe(250);
    expect(d!.members.map((m) => m.name)).toEqual(['Sue Smith', 'Tim Smith']);
    expect(d!.employers).toHaveLength(1);
    expect(d!.employers[0].employer_name).toBe('Acme');
  });

  it('returns null for a missing or soft-deleted application', async () => {
    expect(await getApplicationDetail(db, 999999)).toBeNull();
    const id = await insertApplication(db, app);
    await db.prepare("UPDATE applications SET deleted_at='2026-10-06T00:00:00Z' WHERE id=?").bind(id).run();
    expect(await getApplicationDetail(db, id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `getApplicationDetail` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
export type ApplicationDetail = {
  app: Record<string, unknown>;
  city_name: string;
  members: Record<string, unknown>[];
  employers: Record<string, unknown>[];
};

export async function getApplicationDetail(db: D1Database, id: number): Promise<ApplicationDetail | null> {
  const app = await db
    .prepare('SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!app) return null;
  const city = await db
    .prepare('SELECT name FROM cities WHERE id = ?')
    .bind(app.city_id as number)
    .first<{ name: string }>();
  const members = await db
    .prepare('SELECT * FROM household_members WHERE application_id = ? ORDER BY position')
    .bind(id)
    .all<Record<string, unknown>>();
  const employers = await db
    .prepare('SELECT * FROM employers WHERE application_id = ? ORDER BY id')
    .bind(id)
    .all<Record<string, unknown>>();
  return {
    app,
    city_name: city?.name ?? '',
    members: members.results,
    employers: employers.results,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-admin-detail.test.ts
git commit -m "feat: db helper for full application detail"
```

---

### Task 9: Applications list page

**Files:**
- Create: `src/pages/admin/applications/index.astro`

**Interfaces:**
- Consumes: `listApplications`, `listSeasons` (Task 7); `Admin` layout; a soft-delete undo banner via `?undo=<id>` (the restore action itself is added in Task 10/11).
- Produces: `/admin/applications` — current-season list by default; status tabs (To review = new / Approved / Denied / All) as links carrying `?status=`; a name search box (GET form); a "Previous years" `<select>` (auto-submits via a Go button) carrying `?season=`; **Download list for Excel** and **Print this list** buttons; flagged rows show the words "Check eligibility". A print stylesheet hides chrome.

- [ ] **Step 1: Write the list page**

`src/pages/admin/applications/index.astro`:

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import { listApplications, listSeasons, type ApplicationListRow } from '../../../lib/db';
export const prerender = false;

const db = Astro.locals.runtime.env.DB;
const url = new URL(Astro.request.url);
const currentYear = new Date().getFullYear();
const season = Number(url.searchParams.get('season')) || currentYear;
const statusParam = url.searchParams.get('status') ?? 'new';
const status = (['all', 'new', 'approved', 'denied'].includes(statusParam) ? statusParam : 'new') as
  'all' | 'new' | 'approved' | 'denied';
const search = url.searchParams.get('q') ?? '';
const undoId = url.searchParams.get('undo');

const rows = await listApplications(db, season, status, search);
const seasons = await listSeasons(db);
const yearsToShow = seasons.length > 0 ? seasons : [currentYear];

const tabs = [
  { key: 'new', label: 'To review' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'all', label: 'All' },
];
const qs = (over: Record<string, string>) => {
  const p = new URLSearchParams({ season: String(season), status, q: search, ...over });
  return `?${p.toString()}`;
};
const statusWord = (s: string) => (s === 'new' ? 'To review' : s === 'approved' ? 'Approved' : 'Denied');
const fmtDate = (iso: string) => iso.slice(0, 10);
const exportHref = `/admin/applications/export.csv?season=${season}&status=${status}&q=${encodeURIComponent(search)}`;
---
<Admin title="Applications" heading={`Applications — ${season}`} back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-base text-stone-600">Help: click a name to review one application. Use the tabs to see who still needs review.</p>

  {undoId && (
    <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status">
      <form method="post" action={`/admin/applications/${undoId}/restore`} class="flex flex-wrap items-center gap-3">
        <span class="font-semibold">That application was deleted.</span>
        <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Undo delete</button>
      </form>
    </div>
  )}

  <div class="mt-6 flex flex-wrap items-end gap-4">
    <nav aria-label="Filter by status" class="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <a href={qs({ status: t.key })}
           aria-current={status === t.key ? 'page' : undefined}
           class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 aria-[current=page]:bg-holly-700 aria-[current=page]:text-white">
          {t.label}
        </a>
      ))}
    </nav>
    <form method="get" class="flex items-end gap-2">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="season" value={String(season)} />
      <label class="font-semibold">Search by name
        <input type="text" name="q" value={search} class="ml-2 rounded border-2 border-stone-400 p-2" />
      </label>
      <button type="submit" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Search</button>
    </form>
  </div>

  <div class="mt-4 flex flex-wrap items-end gap-4 print:hidden">
    <form method="get" class="flex items-end gap-2">
      <input type="hidden" name="status" value={status} />
      <label class="font-semibold">Previous years
        <select name="season" class="ml-2 rounded border-2 border-stone-400 p-2">
          {yearsToShow.map((y) => <option value={String(y)} selected={y === season}>{y}</option>)}
        </select>
      </label>
      <button type="submit" class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800">Go</button>
    </form>
    <a href={exportHref} class="rounded bg-berry-700 px-4 py-2 font-bold text-white hover:bg-berry-800">Download list for Excel</a>
    <button type="button" onclick="window.print()" class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800">Print this list</button>
  </div>

  <table class="mt-6 w-full border-collapse bg-white text-left">
    <caption class="sr-only">Applications for {season}, {tabs.find((t) => t.key === status)?.label}</caption>
    <thead>
      <tr>
        <th scope="col" class="border-b-2 border-holly-700 p-3">Name</th>
        <th scope="col" class="border-b-2 border-holly-700 p-3">Town</th>
        <th scope="col" class="border-b-2 border-holly-700 p-3">Applied</th>
        <th scope="col" class="border-b-2 border-holly-700 p-3">Status</th>
        <th scope="col" class="border-b-2 border-holly-700 p-3">PU #</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && (
        <tr><td colspan="5" class="p-4">No applications here yet.</td></tr>
      )}
      {rows.map((r: ApplicationListRow) => (
        <tr>
          <td class="border-b border-stone-200 p-3">
            <a href={`/admin/applications/${r.id}`} class="font-semibold text-berry-700 underline">{r.last_name}, {r.first_name}</a>
            {r.may_not_be_eligible === 1 && <span class="ml-2 rounded bg-gold-500 px-2 py-1 text-sm font-bold text-stone-900">Check eligibility</span>}
          </td>
          <td class="border-b border-stone-200 p-3">{r.city_name}</td>
          <td class="border-b border-stone-200 p-3 whitespace-nowrap">{fmtDate(r.submitted_at)}</td>
          <td class="border-b border-stone-200 p-3">{statusWord(r.status)}</td>
          <td class="border-b border-stone-200 p-3">{r.pu_number ?? ''}</td>
        </tr>
      ))}
    </tbody>
  </table>
</Admin>

<style>
  @media print {
    :global(header), :global(a[href="/admin"]) { display: none; }
  }
</style>
```

- [ ] **Step 2: Verify against a real session**

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8`. Create a session directly in D1 so curl can act as the admin (hash a known id):

```bash
# Insert an admin + a session whose hash we compute with node (same sha256 the app uses):
SID=$(node -e "const b=new Uint8Array(32);crypto.getRandomValues(b);process.stdout.write([...b].map(x=>x.toString(16).padStart(2,'0')).join(''))")
HASH=$(node -e "const s=process.argv[1];crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(d=>process.stdout.write([...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')))" "$SID")
npx wrangler d1 execute gchp --local --command "INSERT OR IGNORE INTO admin_emails (email) VALUES ('boss@example.com')"
npx wrangler d1 execute gchp --local --command "INSERT INTO sessions (session_hash,email,created_at,expires_at) VALUES ('$HASH','boss@example.com','2026-10-01T00:00:00Z','2099-01-01T00:00:00Z')"
# Seed one application via the public form is easier; instead insert a minimal row for listing:
npx wrangler d1 execute gchp --local --command "INSERT INTO applications (season_year,status,submitted_at,first_name,last_name,address,city_id,phone,email,good_deed) VALUES ($(date +%Y),'new','2026-10-01T00:00:00Z','Test','Applicant','1 Elm',13,'608','a@b.co','x')"
curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications" | grep -o "Applicant, Test"   # Expected: match
curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications" | grep -c "<h1"                 # Expected: 1
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4321/admin/applications"                        # Expected: 303 (no cookie → gate)
```

Clean up: `npx wrangler d1 execute gchp --local --command "DELETE FROM applications; DELETE FROM household_members; DELETE FROM employers; DELETE FROM sessions"`. Kill the dev server. Run `npm run test` (79 green) + `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/applications/index.astro
git commit -m "feat: applications list page with tabs, search, seasons, export/print"
```

---

### Task 10: db — status, PU assignment, bags, soft delete/restore (integration TDD)

**Files:**
- Modify: `src/lib/db.ts` (append)
- Test: `tests/db-admin-actions.test.ts`

**Interfaces:**
- Consumes: `getTestDb`, `insertApplication`.
- Produces:
  - `assignPuNumber(db, id, seasonYear): Promise<number>` — if the app already has a `pu_number`, returns it unchanged; else sets it to `max(pu_number for that season)+1` (starting at 1) and returns it.
  - `setApplicationStatus(db, id, status: 'approved' | 'denied'): Promise<void>`.
  - `setBagsCount(db, id, bags: number | null): Promise<void>`.
  - `softDeleteApplication(db, id, nowIso: string): Promise<void>` / `restoreApplication(db, id): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`tests/db-admin-actions.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, assignPuNumber, setApplicationStatus, setBagsCount,
  softDeleteApplication, restoreApplication, getApplicationDetail, listApplications, type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('admin actions', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('assigns sequential PU numbers per season and is idempotent', async () => {
    const a = await insertApplication(db, base);
    const b = await insertApplication(db, base);
    expect(await assignPuNumber(db, a, 2026)).toBe(1);
    expect(await assignPuNumber(db, b, 2026)).toBe(2);
    expect(await assignPuNumber(db, a, 2026)).toBe(1); // idempotent
    const other = await insertApplication(db, { ...base, seasonYear: 2025, submittedAt: '2025-10-01T00:00:00Z' });
    expect(await assignPuNumber(db, other, 2025)).toBe(1); // per-season sequence
  });

  it('sets status and bags', async () => {
    const id = await insertApplication(db, base);
    await setApplicationStatus(db, id, 'approved');
    await setBagsCount(db, id, 3);
    const d = await getApplicationDetail(db, id);
    expect(d!.app.status).toBe('approved');
    expect(d!.app.bags_count).toBe(3);
  });

  it('soft-deletes and restores', async () => {
    const id = await insertApplication(db, base);
    await softDeleteApplication(db, id, '2026-10-05T00:00:00Z');
    expect(await getApplicationDetail(db, id)).toBeNull();
    expect((await listApplications(db, 2026, 'all', '')).some((r) => r.id === id)).toBe(false);
    await restoreApplication(db, id);
    expect(await getApplicationDetail(db, id)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — the new helpers are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
export async function assignPuNumber(db: D1Database, id: number, seasonYear: number): Promise<number> {
  const current = await db
    .prepare('SELECT pu_number FROM applications WHERE id = ?')
    .bind(id)
    .first<{ pu_number: number | null }>();
  if (current?.pu_number != null) return current.pu_number;
  const max = await db
    .prepare('SELECT COALESCE(MAX(pu_number), 0) AS m FROM applications WHERE season_year = ?')
    .bind(seasonYear)
    .first<{ m: number }>();
  const next = (max?.m ?? 0) + 1;
  await db.prepare('UPDATE applications SET pu_number = ? WHERE id = ?').bind(next, id).run();
  return next;
}

export async function setApplicationStatus(
  db: D1Database,
  id: number,
  status: 'approved' | 'denied',
): Promise<void> {
  await db.prepare('UPDATE applications SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function setBagsCount(db: D1Database, id: number, bags: number | null): Promise<void> {
  await db.prepare('UPDATE applications SET bags_count = ? WHERE id = ?').bind(bags, id).run();
}

export async function softDeleteApplication(db: D1Database, id: number, nowIso: string): Promise<void> {
  await db.prepare('UPDATE applications SET deleted_at = ? WHERE id = ?').bind(nowIso, id).run();
}

export async function restoreApplication(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE applications SET deleted_at = NULL WHERE id = ?').bind(id).run();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db-admin-actions.test.ts
git commit -m "feat: db helpers for PU assignment, status, bags, soft delete/restore"
```

---

### Task 11: Application detail + review actions

**Files:**
- Create: `src/pages/admin/applications/[id].astro`, `src/pages/admin/applications/[id]/restore.ts`

**Interfaces:**
- Consumes: `getApplicationDetail`, `assignPuNumber`, `setApplicationStatus`, `softDeleteApplication`, `restoreApplication`, `setBagsCount` (Tasks 8/10); `renderApprovedEmail`/`renderDeniedEmail` (Task 3); `sendEmail`; CSRF helpers; `Admin` layout.
- Produces: `/admin/applications/[id]` GET (readable summary + action buttons + a banner reflecting the last action) and POST (`act` ∈ `approve_email`, `approve_silent`, `deny_email`, `deny_silent`, `set_bags`, `delete`). Approve assigns the next PU# for the app's season. `delete` soft-deletes and 303s to the list with `?undo=<id>`. `restore.ts` is the POST target of the list's Undo. All POSTs CSRF-checked. No PII in any redirect URL.

- [ ] **Step 1: Write the restore endpoint**

`src/pages/admin/applications/[id]/restore.ts`:

```ts
import type { APIRoute } from 'astro';
import { restoreApplication } from '../../../../lib/db';
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
  if (ok && Number.isInteger(id)) await restoreApplication(locals.runtime.env.DB, id);
  return redirect('/admin/applications', 303);
};
```

> The list's Undo form (Task 9) posts only `undo=<id>`; add a hidden `csrf_token` to that form. **Amend Task 9's undo form** to include `<input type="hidden" name="csrf_token" value={csrfToken} />` and compute `csrfToken` in the list page frontmatter (reuse-or-mint the `csrf` cookie exactly as other pages do). If the implementer of Task 11 finds Task 9's form lacks the token, they add it here.

- [ ] **Step 2: Write the detail page**

`src/pages/admin/applications/[id].astro`:

```astro
---
import '../../../styles/global.css';
import Admin from '../../../layouts/Admin.astro';
import {
  getApplicationDetail, assignPuNumber, setApplicationStatus, setBagsCount, softDeleteApplication,
} from '../../../lib/db';
import { renderApprovedEmail, renderDeniedEmail } from '../../../lib/email/render';
import { sendEmail } from '../../../lib/email/send';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);
let banner = '';
let emailNote = '';

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  const act = String(form.get('act') ?? '');
  if (okCsrf) {
    const detail = await getApplicationDetail(env.DB, id);
    if (detail) {
      const season = detail.app.season_year as number;
      const firstName = detail.app.first_name as string;
      const email = detail.app.email as string;
      if (act === 'approve_email' || act === 'approve_silent') {
        await assignPuNumber(env.DB, id, season);
        await setApplicationStatus(env.DB, id, 'approved');
        banner = 'Approved.';
        if (act === 'approve_email') {
          const r = await sendEmail(env, email, renderApprovedEmail(firstName));
          emailNote = r.sent ? 'Approval email sent.' : 'Approved, but the email could not be sent right now — their application is still saved.';
        }
      } else if (act === 'deny_email' || act === 'deny_silent') {
        await setApplicationStatus(env.DB, id, 'denied');
        banner = 'Marked as denied.';
        if (act === 'deny_email') {
          const r = await sendEmail(env, email, renderDeniedEmail(firstName));
          emailNote = r.sent ? 'Email sent.' : 'Saved, but the email could not be sent right now.';
        }
      } else if (act === 'set_bags') {
        const raw = String(form.get('bags_count') ?? '').trim();
        await setBagsCount(env.DB, id, raw === '' ? null : Math.max(0, Math.floor(Number(raw)) || 0));
        banner = 'Bag count saved.';
      } else if (act === 'delete') {
        await softDeleteApplication(env.DB, id, new Date().toISOString());
        return Astro.redirect(`/admin/applications?undo=${id}`, 303);
      }
    }
  }
}

const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;

const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);

const money = (v: unknown) => (v == null ? '—' : `$${Number(v).toFixed(2)}`);
const yesno = (v: unknown) => (v === 1 || v === true ? 'Yes' : 'No');
const a = detail?.app ?? {};
const statusWord = a.status === 'approved' ? 'Approved' : a.status === 'denied' ? 'Denied' : 'To review';
---
<Admin title="Application" heading={detail ? `${a.first_name} ${a.last_name}` : 'Application not found'} back={{ href: '/admin/applications', label: 'Back to applications' }}>
  {!detail ? (
    <p class="mt-4">That application could not be found. It may have been deleted.</p>
  ) : (
    <>
      {banner && <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status"><p class="font-bold text-holly-800">{banner} {emailNote}</p></div>}
      {a.may_not_be_eligible === 1 && (
        <div class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4">
          <p class="font-bold">Please check eligibility.</p>
          <p>Our rule of thumb: households with children, or an adult over 65 or permanently disabled. Use your judgment.</p>
        </div>
      )}

      <p class="mt-4 text-xl"><strong>Status:</strong> {statusWord}{a.pu_number != null && <> · <strong>Pickup #</strong> {a.pu_number}</>}</p>

      <section class="mt-6 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Household</h2>
        <p class="mt-2">{a.address}, {detail.city_name}</p>
        <p>Phone: {a.phone} · Email: {a.email}</p>
        <p>Household type: {a.household_type} · Diabetic in household: {yesno(a.diabetic)} · OK to share needs with a sponsor: {yesno(a.share_with_sponsor)}</p>
        <p>Bed: {a.bed_choice}{a.bed_size ? ` (${a.bed_size})` : ''} · Years received help: {a.years_received_help} · Adopted last year: {yesno(a.adopted_last_year)}</p>
      </section>

      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">People ({detail.members.length})</h2>
        <table class="mt-2 w-full border-collapse text-left">
          <thead><tr><th class="border-b p-2">Name</th><th class="border-b p-2">Relationship</th><th class="border-b p-2">Sex</th><th class="border-b p-2">Age</th><th class="border-b p-2">Sizes</th><th class="border-b p-2">Gifts wanted</th></tr></thead>
          <tbody>
            {detail.members.map((m) => (
              <tr>
                <td class="border-b p-2">{m.name}</td>
                <td class="border-b p-2">{m.relationship}</td>
                <td class="border-b p-2">{m.sex}</td>
                <td class="border-b p-2">{m.age}</td>
                <td class="border-b p-2">{[['Pants', m.pants], ['Shirt', m.shirt_top], ['Underwear', m.underwear], ['Socks', m.socks], ['Diapers', m.diapers]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</td>
                <td class="border-b p-2">{m.gifts || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Income</h2>
        {detail.employers.length === 0 ? <p class="mt-2">No one in the household is employed.</p> : (
          <ul class="mt-2 list-disc pl-6">
            {detail.employers.map((e) => <li>{e.worker_name} at {e.employer_name}: {money(e.hourly_wage)}/hr, {e.hours_per_week} hrs/week</li>)}
          </ul>
        )}
        <p class="mt-2">Food Share: {money(a.food_share_amount)} · Social Security: {money(a.social_security_amount)} · SSI: {money(a.ssi_amount)} · Child support: {money(a.child_support_amount)} · Unemployment (weekly): {money(a.unemployment_weekly_amount)} · Other: {money(a.other_income_amount)}</p>
      </section>

      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Good deed</h2>
        <p class="mt-2 whitespace-pre-wrap">{a.good_deed}</p>
      </section>

      <section class="mt-6 flex flex-wrap gap-3">
        <a href={`/admin/applications/${id}/slip`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Print pickup slip</a>
        <a href={`/admin/applications/${id}/edit`} class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Edit this application</a>
      </section>

      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Decision</h2>
        <p class="text-base text-stone-600">Approving assigns the next pickup number for {a.season_year}.</p>
        <form method="post" class="mt-3 flex flex-wrap gap-3">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <button type="submit" name="act" value="approve_email" class="rounded bg-holly-700 px-4 py-3 font-bold text-white hover:bg-holly-900">Approve and email them</button>
          <button type="submit" name="act" value="approve_silent" class="rounded border-2 border-holly-700 px-4 py-3 font-bold text-holly-800">Approve without email</button>
          <button type="submit" name="act" value="deny_email" class="rounded border-2 border-berry-700 px-4 py-3 font-bold text-berry-800">Deny and email them</button>
          <button type="submit" name="act" value="deny_silent" class="rounded border-2 border-stone-400 px-4 py-3 font-semibold">Deny without email</button>
        </form>
      </section>

      <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
        <h2 class="text-2xl font-bold text-holly-800">Bags</h2>
        <form method="post" class="mt-2 flex flex-wrap items-end gap-3">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <label class="font-semibold">Number of bags
            <input type="text" inputmode="numeric" name="bags_count" value={a.bags_count ?? ''} class="ml-2 w-24 rounded border-2 border-stone-400 p-2" />
          </label>
          <button type="submit" name="act" value="set_bags" class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save bags</button>
        </form>
      </section>

      <section class="mt-6 rounded-lg border-2 border-berry-700 bg-white p-5">
        <h2 class="text-2xl font-bold text-berry-800">Delete</h2>
        <p>This removes the application from your lists. You'll get an <strong>Undo</strong> link right after, so it's safe.</p>
        <form method="post" class="mt-2" onsubmit="return confirm('Delete this application? You will get an Undo link on the next screen.')">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <button type="submit" name="act" value="delete" class="rounded bg-berry-700 px-4 py-3 font-bold text-white hover:bg-berry-800">Delete this application</button>
        </form>
      </section>
    </>
  )}
</Admin>
```

- [ ] **Step 3: Amend the list page's Undo form to carry a CSRF token**

In `src/pages/admin/applications/index.astro` frontmatter, add (reuse-or-mint pattern):

```ts
import { newCsrfCookieValue, csrfTokenFor } from '../../../lib/csrf';
const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(Astro.locals.runtime.env.CSRF_SECRET, cookieValue);
```

And in the undo `<form>`, add before the button: `<input type="hidden" name="csrf_token" value={csrfToken} />`.

- [ ] **Step 4: Verify the review loop live**

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8`. Create a session + admin (as in Task 9), seed one application row, then drive:

```bash
# (reuse the SID/HASH/admin/session/application setup from Task 9)
# GET the detail page, grab csrf:
CT=$(curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications/1" | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}' | head -1)
# Approve without email:
curl -s -b "admin_session=$SID" --data-urlencode "csrf_token=$CT" --data-urlencode "act=approve_silent" "http://localhost:4321/admin/applications/1" | grep -o "Approved."   # Expected: match
npx wrangler d1 execute gchp --local --command "SELECT status, pu_number FROM applications WHERE id=1"   # Expected: approved | 1
# Delete → 303 to list with undo:
CT=$(curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications/1" | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}' | head -1)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b "admin_session=$SID" --data-urlencode "csrf_token=$CT" --data-urlencode "act=delete" "http://localhost:4321/admin/applications/1"   # Expected: 303 .../admin/applications?undo=1
npx wrangler d1 execute gchp --local --command "SELECT deleted_at FROM applications WHERE id=1"   # Expected: a timestamp
```

Clean up all rows (children first) + sessions. Kill the dev server. `npm run test` + `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add "src/pages/admin/applications/[id].astro" "src/pages/admin/applications/[id]/restore.ts" src/pages/admin/applications/index.astro
git commit -m "feat: application detail, approve/deny with emails, PU assignment, delete/undo"
```

---

### Task 12: Application edit page

**Files:**
- Modify: `src/lib/db.ts` (append `updateApplicationCore`)
- Create: `src/pages/admin/applications/[id]/edit.astro`
- Test: `tests/db-admin-update.test.ts`

**Interfaces:**
- Consumes: `getApplicationDetail`, `listCities`, `parseIntInRange` (validation module), CSRF, `Admin`.
- Produces:
  - `updateApplicationCore(db, id, fields): Promise<void>` — updates the editable top-level applicant fields (name, address, city_id, phone, email, diabetic, share_with_sponsor, permanently_disabled, bed_choice, bed_size, years_received_help, adopted_last_year, household_type). Members/employers/benefits editing is deferred to Plan 3b — this page edits the applicant core, which is what she most often fixes (typos). Field type: `type ApplicationCoreEdit = { firstName: string; lastName: string; address: string; cityId: number; phone: string; email: string; diabetic: boolean; shareWithSponsor: boolean; permanentlyDisabled: boolean; bedChoice: 'sheets'|'blanket'|'none'; bedSize: 'twin'|'full'|'queen'|'king'|null; yearsReceivedHelp: number; adoptedLastYear: boolean; householdType: 'family'|'elderly'|'disabled' }`.
  - `/admin/applications/[id]/edit` GET (pre-filled form) + POST (validate lightly, save, 303 back to the detail page).

- [ ] **Step 1: Write the failing test**

`tests/db-admin-update.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, updateApplicationCore, getApplicationDetail, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('updateApplicationCore', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('updates editable core fields, leaving members untouched', async () => {
    const id = await insertApplication(db, base);
    await updateApplicationCore(db, id, {
      firstName: 'Susan', lastName: 'Smith', address: '2 Oak St', cityId: 13, phone: '608-555',
      email: 'susan@example.com', diabetic: true, shareWithSponsor: true, permanentlyDisabled: false,
      bedChoice: 'blanket', bedSize: 'queen', yearsReceivedHelp: 3, adoptedLastYear: true, householdType: 'elderly',
    });
    const d = await getApplicationDetail(db, id);
    expect(d!.app.first_name).toBe('Susan');
    expect(d!.app.address).toBe('2 Oak St');
    expect(d!.app.diabetic).toBe(1);
    expect(d!.app.bed_size).toBe('queen');
    expect(d!.app.household_type).toBe('elderly');
    expect(d!.members).toHaveLength(1); // untouched
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `updateApplicationCore` not exported.

- [ ] **Step 3: Implement the helper**

Append to `src/lib/db.ts`:

```ts
export type ApplicationCoreEdit = {
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
};

export async function updateApplicationCore(db: D1Database, id: number, f: ApplicationCoreEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE applications SET
         first_name = ?, last_name = ?, address = ?, city_id = ?, phone = ?, email = ?,
         diabetic = ?, share_with_sponsor = ?, permanently_disabled = ?,
         bed_choice = ?, bed_size = ?, years_received_help = ?, adopted_last_year = ?, household_type = ?
       WHERE id = ?`,
    )
    .bind(
      f.firstName, f.lastName, f.address, f.cityId, f.phone, f.email,
      f.diabetic ? 1 : 0, f.shareWithSponsor ? 1 : 0, f.permanentlyDisabled ? 1 : 0,
      f.bedChoice, f.bedSize, f.yearsReceivedHelp, f.adoptedLastYear ? 1 : 0, f.householdType,
      id,
    )
    .run();
}
```

- [ ] **Step 4: Run to verify the helper test passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Write the edit page**

`src/pages/admin/applications/[id]/edit.astro`:

```astro
---
import '../../../../styles/global.css';
import Admin from '../../../../layouts/Admin.astro';
import { getApplicationDetail, listCities, updateApplicationCore } from '../../../../lib/db';
import { parseIntInRange } from '../../../../lib/validation/application';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../../../../lib/csrf';
export const prerender = false;

const env = Astro.locals.runtime.env;
const id = Number(Astro.params.id);

if (Astro.request.method === 'POST' && Number.isInteger(id)) {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(env.CSRF_SECRET, Astro.cookies.get('csrf')?.value ?? '', String(form.get('csrf_token') ?? ''));
  if (okCsrf) {
    const g = (k: string) => String(form.get(k) ?? '').trim();
    const on = (k: string) => form.get(k) === 'on';
    const bedChoice = (['sheets', 'blanket', 'none'].includes(g('bed_choice')) ? g('bed_choice') : 'none') as 'sheets' | 'blanket' | 'none';
    const bedSize = ['twin', 'full', 'queen', 'king'].includes(g('bed_size')) ? (g('bed_size') as 'twin' | 'full' | 'queen' | 'king') : null;
    const ht = (['family', 'elderly', 'disabled'].includes(g('household_type')) ? g('household_type') : 'family') as 'family' | 'elderly' | 'disabled';
    await updateApplicationCore(env.DB, id, {
      firstName: g('first_name'), lastName: g('last_name'), address: g('address'),
      cityId: parseIntInRange(g('city_id'), 1, 9999) ?? 13, phone: g('phone'), email: g('email'),
      diabetic: on('diabetic'), shareWithSponsor: on('share_with_sponsor'), permanentlyDisabled: on('permanently_disabled'),
      bedChoice, bedSize: bedChoice === 'none' ? null : bedSize,
      yearsReceivedHelp: parseIntInRange(g('years_received_help'), 0, 99) ?? 0, adoptedLastYear: on('adopted_last_year'), householdType: ht,
    });
    return Astro.redirect(`/admin/applications/${id}`, 303);
  }
}

const detail = Number.isInteger(id) ? await getApplicationDetail(env.DB, id) : null;
const cities = await listCities(env.DB);
const cookieExisting = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(cookieExisting) ? cookieExisting : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
const a = detail?.app ?? {};
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3';
---
<Admin title="Edit application" heading={detail ? `Edit — ${a.first_name} ${a.last_name}` : 'Not found'} back={{ href: `/admin/applications/${id}`, label: 'Back without saving' }}>
  {!detail ? <p class="mt-4">That application could not be found.</p> : (
    <form method="post" class="mt-6 max-w-2xl space-y-4">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <p class="text-base text-stone-600">Help: fix typos in the family's details here. To change who is in the household, use the next update (coming soon).</p>
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
      </div>
      <button type="submit" class="rounded-lg bg-holly-700 px-6 py-3 text-lg font-bold text-white hover:bg-holly-900">Save changes</button>
    </form>
  )}
</Admin>
```

- [ ] **Step 6: Verify + commit**

Run: `npm run test` (all pass), `npm run build` (Complete!). Then:

```bash
git add src/lib/db.ts tests/db-admin-update.test.ts "src/pages/admin/applications/[id]/edit.astro"
git commit -m "feat: edit an application's core details"
```

---

### Task 13: CSV export

**Files:**
- Create: `src/lib/csv.ts`, `src/pages/admin/applications/export.csv.ts`
- Modify: `src/lib/db.ts` (append `listApplicationsForExport`)
- Test: `tests/csv.test.ts`

**Interfaces:**
- Consumes: `getTestDb`; the applications/members tables.
- Produces:
  - `type ExportRow = { pu_number: number|null; status: string; submitted_at: string; first_name: string; last_name: string; address: string; city_name: string; phone: string; email: string; household_type: string; may_not_be_eligible: number; bags_count: number|null; member_summary: string }`
  - `listApplicationsForExport(db, seasonYear, status): Promise<ExportRow[]>` — same filters as `listApplications` (no name search), with `member_summary` = `group_concat(name || ' (' || age || ')')`.
  - `toCsv(headers: string[], rows: (string|number|null)[][]): string` — RFC-4180 quoting (double quotes, `""` escaping, CRLF line breaks), prefixed with a UTF-8 BOM so Excel opens accents correctly.
  - `export.csv.ts` GET → streams the CSV with a `Content-Disposition: attachment` filename `applications-<season>-<status>.csv`.

- [ ] **Step 1: Write the failing CSV tests**

`tests/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/lib/csv';

describe('toCsv', () => {
  it('quotes fields containing comma, quote, or newline and escapes quotes', () => {
    const out = toCsv(['a', 'b'], [['plain', 'has,comma'], ['has"quote', 'has\nnewline']]);
    // strip BOM for assertion
    const body = out.replace(/^﻿/, '');
    expect(body).toBe(
      'a,b\r\n' +
        'plain,"has,comma"\r\n' +
        '"has""quote","has\nnewline"\r\n',
    );
  });

  it('starts with a UTF-8 BOM and renders null as empty', () => {
    const out = toCsv(['x'], [[null]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.replace(/^﻿/, '')).toBe('x\r\n\r\n');
  });

  it('renders numbers without quoting', () => {
    expect(toCsv(['n'], [[42]]).replace(/^﻿/, '')).toBe('n\r\n42\r\n');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/csv'`.

- [ ] **Step 3: Implement `toCsv`**

`src/lib/csv.ts`:

```ts
// Minimal RFC-4180 CSV with a UTF-8 BOM so Excel opens accented names correctly.
function cell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: Run to verify the CSV tests pass**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Implement the export query**

Append to `src/lib/db.ts`:

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
  member_summary: string;
};

export async function listApplicationsForExport(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
): Promise<ExportRow[]> {
  const statusFilter = status === 'all' ? '' : 'AND a.status = ?2';
  const sql = `
    SELECT a.pu_number, a.status, a.submitted_at, a.first_name, a.last_name, a.address,
           c.name AS city_name, a.phone, a.email, a.household_type, a.may_not_be_eligible, a.bags_count,
           COALESCE(GROUP_CONCAT(m.name || ' (' || m.age || ')', '; '), '') AS member_summary
    FROM applications a
    JOIN cities c ON c.id = a.city_id
    LEFT JOIN household_members m ON m.application_id = a.id
    WHERE a.deleted_at IS NULL AND a.season_year = ?1 ${statusFilter}
    GROUP BY a.id
    ORDER BY a.submitted_at DESC, a.id DESC`;
  const stmt =
    status === 'all'
      ? db.prepare(sql).bind(seasonYear)
      : db.prepare(sql).bind(seasonYear, status);
  const { results } = await stmt.all<ExportRow>();
  return results;
}
```

> **Implementer note:** named parameters `?1`/`?2` with D1 `.bind()` are positional-by-number; when `status === 'all'` the `?2` reference is absent from the SQL string (it's inside the omitted `statusFilter`), so binding only `seasonYear` is correct. Verify both branches run without a "wrong number of parameter bindings" error in the Task-13 integration check below; if D1 rejects the numbered form, switch both branches to plain positional `?` and duplicate the season bind as needed.

- [ ] **Step 6: Write the export endpoint**

`src/pages/admin/applications/export.csv.ts`:

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
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status);
  const headers = [
    'Pickup #', 'Status', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type', 'Check eligibility', 'Bags', 'People',
  ];
  const body = toCsv(
    headers,
    rows.map((r) => [
      r.pu_number, r.status, r.submitted_at.slice(0, 10), r.first_name, r.last_name, r.address,
      r.city_name, r.phone, r.email, r.household_type, r.may_not_be_eligible === 1 ? 'yes' : '', r.bags_count, r.member_summary,
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

- [ ] **Step 7: Verify the export live**

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8`. With a session + a seeded application (as before):

```bash
curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications/export.csv?season=$(date +%Y)&status=all" -o /tmp/apps.csv
head -c 3 /tmp/apps.csv | xxd | grep -o "efbb bf"    # Expected: BOM present
grep -c "Pickup #,Status" /tmp/apps.csv               # Expected: 1 (header row)
```

Clean up rows + session. Kill the dev server. `npm run test` + `npm run build`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/csv.ts src/lib/db.ts src/pages/admin/applications/export.csv.ts tests/csv.test.ts
git commit -m "feat: download applications list for Excel (CSV export)"
```

---

### Task 14: Pickup slips — single + batch

**Files:**
- Create: `src/components/admin/SlipCard.astro`, `src/pages/admin/applications/[id]/slip.astro`, `src/pages/admin/applications/slips.astro`
- Modify: `src/lib/db.ts` (append `listApprovedForSlips`)
- Test: `tests/db-admin-slips.test.ts`

**Interfaces:**
- Consumes: `getApplicationDetail` (single), a new `listApprovedForSlips` (batch), `Admin` layout is NOT used (slips are bare print pages).
- Produces:
  - `listApprovedForSlips(db, seasonYear): Promise<ApplicationDetail[]>` — all approved, non-deleted apps for the season ordered by `pu_number` (nulls last), each with members.
  - `SlipCard.astro` — one household's slip: PU#, a "Bags: ____" line (or the number), name/address/phone/count, member table with sizes and gifts, diabetic + sponsor flags. Page-breaks after each card when printing.
  - `/admin/applications/[id]/slip` — one slip, auto-print friendly. `/admin/applications/slips?season=YYYY` — all approved slips for the season, batch print.

- [ ] **Step 1: Write the failing test**

`tests/db-admin-slips.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, assignPuNumber, setApplicationStatus, listApprovedForSlips, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('listApprovedForSlips', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('returns only approved apps for the season, ordered by PU number, with members', async () => {
    const a = await insertApplication(db, { ...base, firstName: 'Second' });
    const b = await insertApplication(db, { ...base, firstName: 'First' });
    await insertApplication(db, { ...base, firstName: 'NotApproved' }); // stays 'new'
    await setApplicationStatus(db, a, 'approved');
    await setApplicationStatus(db, b, 'approved');
    await assignPuNumber(db, a, 2026); // PU 1
    await assignPuNumber(db, b, 2026); // PU 2
    const slips = await listApprovedForSlips(db, 2026);
    expect(slips.map((s) => s.app.first_name)).toEqual(['Second', 'First']); // by PU asc
    expect(slips.every((s) => s.members.length === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test`
Expected: FAIL — `listApprovedForSlips` not exported.

- [ ] **Step 3: Implement the query**

Append to `src/lib/db.ts`:

```ts
export async function listApprovedForSlips(db: D1Database, seasonYear: number): Promise<ApplicationDetail[]> {
  const apps = await db
    .prepare(
      `SELECT * FROM applications
       WHERE deleted_at IS NULL AND season_year = ? AND status = 'approved'
       ORDER BY pu_number IS NULL, pu_number, id`,
    )
    .bind(seasonYear)
    .all<Record<string, unknown>>();
  const out: ApplicationDetail[] = [];
  for (const app of apps.results) {
    const id = app.id as number;
    const city = await db.prepare('SELECT name FROM cities WHERE id = ?').bind(app.city_id as number).first<{ name: string }>();
    const members = await db.prepare('SELECT * FROM household_members WHERE application_id = ? ORDER BY position').bind(id).all<Record<string, unknown>>();
    const employers = await db.prepare('SELECT * FROM employers WHERE application_id = ? ORDER BY id').bind(id).all<Record<string, unknown>>();
    out.push({ app, city_name: city?.name ?? '', members: members.results, employers: employers.results });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify the query test passes**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Write the slip card component**

`src/components/admin/SlipCard.astro`:

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
    <span><strong>Bags:</strong> {a.bags_count ?? '____'}</span>
    <span><strong>People:</strong> {detail.members.length}</span>
  </div>
  <p class="name"><strong>{a.first_name} {a.last_name}</strong> — {a.phone}</p>
  <p>{a.address}, {detail.city_name}</p>
  <p>
    {a.diabetic === 1 && <span class="flag">DIABETIC</span>}
    {a.bed_choice !== 'none' && <span>Bed: {a.bed_choice}{a.bed_size ? ` (${a.bed_size})` : ''}</span>}
    {a.share_with_sponsor === 1 && <span> · sponsor OK</span>}
  </p>
  <table>
    <thead><tr><th>Name</th><th>Sex</th><th>Age</th><th>Sizes</th><th>Gifts</th></tr></thead>
    <tbody>
      {detail.members.map((m) => (
        <tr><td>{m.name}</td><td>{m.sex}</td><td>{m.age}</td><td>{sizes(m)}</td><td>{m.gifts || '—'}</td></tr>
      ))}
    </tbody>
  </table>
</article>
<style>
  .slip { border: 2px solid #000; padding: 12px; margin: 0 0 16px; font-size: 14px; break-inside: avoid; }
  .row { display: flex; gap: 24px; font-size: 16px; }
  .name { font-size: 18px; margin: 8px 0 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #666; padding: 4px 6px; text-align: left; }
  .flag { font-weight: bold; color: #b91c1c; margin-right: 8px; }
  @media print { .slip { page-break-after: always; } }
</style>
```

- [ ] **Step 6: Write the single-slip page**

`src/pages/admin/applications/[id]/slip.astro`:

```astro
---
import SlipCard from '../../../../components/admin/SlipCard.astro';
import { getApplicationDetail } from '../../../../lib/db';
export const prerender = false;
const id = Number(Astro.params.id);
const detail = Number.isInteger(id) ? await getApplicationDetail(Astro.locals.runtime.env.DB, id) : null;
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Pickup slip</title></head>
  <body style="margin:16px;font-family:Georgia,serif;">
    {detail ? (
      <>
        <p class="no-print"><a href={`/admin/applications/${id}`}>&larr; Back</a> · <button type="button" onclick="window.print()">Print this slip</button></p>
        <SlipCard detail={detail} />
      </>
    ) : <p>That application could not be found.</p>}
    <style>@media print { .no-print { display: none; } }</style>
  </body>
</html>
```

- [ ] **Step 7: Write the batch-slips page**

`src/pages/admin/applications/slips.astro`:

```astro
---
import SlipCard from '../../../components/admin/SlipCard.astro';
import { listApprovedForSlips } from '../../../lib/db';
export const prerender = false;
const season = Number(new URL(Astro.request.url).searchParams.get('season')) || new Date().getFullYear();
const slips = await listApprovedForSlips(Astro.locals.runtime.env.DB, season);
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Pickup slips {season}</title></head>
  <body style="margin:16px;font-family:Georgia,serif;">
    <p class="no-print"><a href="/admin/applications">&larr; Back to applications</a> · <button type="button" onclick="window.print()">Print all {slips.length} slips</button></p>
    <h1 style="font-size:20px;">Approved pickup slips — {season} ({slips.length})</h1>
    {slips.length === 0 && <p>No approved applications yet.</p>}
    {slips.map((d) => <SlipCard detail={d} />)}
    <style>@media print { .no-print, h1 { display: none; } }</style>
  </body>
</html>
```

- [ ] **Step 8: Add the batch-print button to the list page**

In `src/pages/admin/applications/index.astro`, in the print/export button row, add after the "Print this list" button:

```astro
    <a href={`/admin/applications/slips?season=${season}`} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800">Print all approved slips</a>
```

- [ ] **Step 9: Verify slips live**

Run dev server + session + one approved application with a PU number:

```bash
curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications/1/slip" | grep -o "PU #"            # Expected: match
curl -s -b "admin_session=$SID" "http://localhost:4321/admin/applications/slips?season=$(date +%Y)" | grep -c "class=\"slip\""   # Expected: number of approved apps
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4321/admin/applications/1/slip"                    # Expected: 303 (gate; no cookie)
```

Clean up + kill server. `npm run test` + `npm run build`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/db.ts tests/db-admin-slips.test.ts src/components/admin/SlipCard.astro "src/pages/admin/applications/[id]/slip.astro" src/pages/admin/applications/slips.astro src/pages/admin/applications/index.astro
git commit -m "feat: printable pickup slips - single and batch"
```

---

### Task 15: Exit verification + README admin notes

**Files:**
- Modify: `README.md`

**Interfaces:** consumes everything; produces docs + a verified exit state.

- [ ] **Step 1: Add an admin section to README's Local development**

After the "Working on the application form" block, add:

```markdown
### Working on the admin console

The admin is at `/admin`. To sign in locally you need an allow-listed email and a way to
receive the magic link. Two options:

1. **Add your email to the allow-list** and read the link from the dev server log (email
   sending fails without a real Resend key, but the link is built and the token row is created):

       npx wrangler d1 execute gchp --local --command "INSERT OR IGNORE INTO admin_emails (email) VALUES ('you@example.com')"

   Then request a link at http://localhost:4321/admin and check the token in the database.

2. **Create a session row directly** (fastest for iterating on admin pages). Generate a random
   id, store its SHA-256 hash in `sessions`, and send the raw id as the `admin_session` cookie.
   See `.superpowers/sdd` verification notes, or use the browser after a real magic-link round trip.

The applications workflow lives under `/admin/applications`. Test rows must be deleted
children-first (`household_members`, `employers`, then `applications`) because of foreign keys.
```

- [ ] **Step 2: Full verification**

Run: `npm run test` — all pass (Plan 2's 79 + everything added here), pristine output.
Run: `npm run build` — Complete!.
Run: `npx tsc --noEmit` — clean.

Spot-check the exit criteria below; anything failing goes back to its task.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: local dev notes for the admin console"
```

---

## Plan 3a exit criteria

- Suite, build, and typecheck green.
- **Auth:** unauthenticated `/admin/*` (except `/admin` and `/admin/verify`) 303s to `/admin`; the sign-in page never reveals whether an address is allow-listed; a magic link signs the operator in for 30 days (renewing on use); sign-out ends the session; login tokens are single-use and expire in 15 minutes; tokens and session ids are stored only as hashes. Verified by integration tests + live gate checks.
- **Applications workflow:** current-season list by default with To review / Approved / Denied / All tabs, name search, previous-years selector, "Check eligibility" flag in words, Download list for Excel, Print this list, Print all approved slips. Detail page shows a readable summary and approves (assigning the next per-season PU#) / denies with optional applicant emails (send failure never blocks), edits core details, sets bag counts, and soft-deletes with an Undo on the list. Single and batch pickup slips print cleanly.
- **Admin usability:** every admin screen ≥18px, plain English, text-labelled buttons, one primary action, a Back link, a one-sentence Help note, confirmation before delete, soft-delete + Undo. One `<h1>` per page; works with JavaScript disabled (the only JS is `window.print()`).
- **Security:** no applicant PII in logs, URLs, or email subjects; all D1 access parameterized; CSRF on every admin POST; `/admin` responses `no-store`.
- Not in this plan (Plan 3b): applications-open toggle, news/gifts editor, pickup-schedule editor, donors + donations, contact messages, paper-application PDF upload, and editing household members/employers/benefits from the admin.
