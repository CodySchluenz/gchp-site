# Plan 2: Applicant Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/apply` stub with the real one-page application form — season-gated, fully validated server-side, eligibility-flagged, writing to D1, confirmed by page + email — per spec §3.

**Architecture:** All rules live in pure, TDD'd modules (`src/lib/validation/application.ts`, `src/lib/eligibility.ts`); the page (`src/pages/apply.astro`) is a thin shell that parses the form, calls the modules, and renders. D1 writes go through one `insertApplication` helper, integration-tested against a real local D1 via wrangler's `getPlatformProxy`. "Add another person/employer" is a real submit that re-renders with values preserved; a small vanilla script upgrades it to instant. Success uses POST→303→GET to a static thank-you page (no resubmit dialogs).

**Tech Stack:** unchanged from Plan 1 — Astro 5 + @astrojs/cloudflare, Tailwind 4, D1, Resend via fetch, Vitest, wrangler (its `getPlatformProxy` powers the new integration tests; it is already a devDependency).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-gchp-site-design.md` §3 (plus §2 columns, §7 security, §8 email #1). It governs on conflict.
- **No new dependencies of any kind.** Runtime deps stay exactly: `astro`, `@astrojs/cloudflare`, `tailwindcss`, `@tailwindcss/vite`. Dev deps stay exactly: `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`.
- **Binding notes from Plan 1's final review (recorded in the Plan 1 doc):**
  - **Never pretend-success on CSRF failure for `/apply`.** A CSRF failure re-renders the form with every value preserved plus a friendly "press Submit once more" note. Fake success (redirect without saving) is permitted ONLY for the honeypot.
  - **Never silently drop a valid application.** The rate-limit path re-renders with values preserved and a kind note — it does NOT pretend success.
  - Do not give form controls their own `box-shadow` (the global `:focus-visible` two-tone ring replaces component box-shadows on focus).
  - Assert D1 foreign-key enforcement in the integration tests (Task 1).
  - Add a rate-limiter boundary-exact test and a D1RateStore integration test (Task 2).
  - Surface the Resend error response body in `sendEmail` failures (Task 3).
- Mobile-first, correct at 360px, WCAG 2.2 AA, base text ≥ 18px, works fully with JavaScript disabled, warm plain language at a low reading level. Exactly one `<h1>` per page.
- Phone everywhere: **608-723-2136 ext 1194**. Paper application link: **/application.pdf**. Address: **235 W. Elm St., Lancaster WI 53813**.
- No applicant PII in logs, URLs (including redirects), or email subject lines. All D1 access via prepared statements with `.bind()`. Secrets only in `.dev.vars`/Cloudflare env.
- TDD for every logic module (Tasks 2–8): failing test first, then implementation. Run the full suite before each commit.
- `season_year` = the calendar year of `submitted_at` (spec §2). Eligibility formula and household-type suggestion exactly as spec §3.
- Node ≥ 22; repo root is the project root; Git Bash on Windows.
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Plan 1's suite has **21 tests**; every task's full-suite run must keep all prior tests green.

## Existing interfaces consumed (from Plan 1 — exact)

- `src/lib/csrf.ts`: `newCsrfCookieValue(): string`, `csrfTokenFor(secret, cookieValue): Promise<string>`, `verifyCsrf(secret, cookieValue, token): Promise<boolean>`.
- `src/lib/rate-limit.ts`: `interface RateStore`, `allowRequest(store, key, limit, windowMs, now): Promise<boolean>`, `MemoryRateStore`, `D1RateStore(db)`.
- `src/lib/email/render.ts`: `escapeHtml(s)`, `emailShell(title, bodyHtml)`, `type RenderedEmail`. `src/lib/email/send.ts`: `sendEmail(env, to, email, replyTo?): Promise<{sent:true}|{sent:false;error:string}>`.
- `src/lib/db.ts`: `getSettings(db)` (has `applications_open: number`), plus content/pickup/contact helpers.
- `src/layouts/Site.astro` (`<Site title="...">`), theme tokens in `src/styles/global.css`, the contact page's stable-csrf-cookie pattern (`src/pages/contact.astro`).
- Schema (migrations/0001_init.sql): `applications`, `household_members`, `employers` columns exactly as spec §2.

---

### Task 1: D1 integration-test harness + foreign-key assertions

**Files:**
- Create: `tests/helpers/d1.ts`, `tests/d1-schema.test.ts`

**Interfaces:**
- Consumes: `migrations/0001_init.sql`, wrangler's `getPlatformProxy` (devDep).
- Produces: `getTestDb(): Promise<{ db: D1Database; dispose: () => Promise<void> }>` — a fresh in-memory local D1 with the full schema applied and one seed city (id 13, Lancaster) plus the settings row. Later tasks (2, 8) build integration tests on this.

- [ ] **Step 1: Write the harness**

`tests/helpers/d1.ts`:

```ts
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';

type Env = { DB: D1Database };

// Fresh, isolated local D1 per call: schema from the real migration file,
// minimal seed rows (one city for FK targets, the settings row).
export async function getTestDb(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<Env>({ persist: false });
  const db = proxy.env.DB;
  const sql = readFileSync('migrations/0001_init.sql', 'utf8');
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }
  await db.prepare("INSERT INTO cities (id, name, zip) VALUES (13, 'Lancaster', '53813')").run();
  await db.prepare('INSERT INTO settings (id, applications_open) VALUES (1, 1)').run();
  return { db, dispose: () => proxy.dispose() };
}
```

- [ ] **Step 2: Write the failing FK tests**

`tests/d1-schema.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';

// Binding note from Plan 1's final review: assert that D1 actually enforces
// the REFERENCES clauses before any code relies on them.
describe('D1 schema integrity', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it('rejects a household member pointing at a missing application', async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO household_members (application_id, position, name, relationship, sex, age) VALUES (99999, 1, 'x', 'self', 'F', 30)",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects an employer pointing at a missing application', async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO employers (application_id, employer_name, worker_name, hourly_wage, hours_per_week) VALUES (99999, 'x', 'x', 10, 40)",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects an application pointing at a missing city', async () => {
    await expect(
      db
        .prepare(
          `INSERT INTO applications (season_year, submitted_at, first_name, last_name, address, city_id, phone, email)
           VALUES (2026, '2026-10-01T00:00:00Z', 'A', 'B', '1 Elm', 424242, '555', 'a@b.co')`,
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('accepts a valid application row against the seeded city', async () => {
    const res = await db
      .prepare(
        `INSERT INTO applications (season_year, submitted_at, first_name, last_name, address, city_id, phone, email)
         VALUES (2026, '2026-10-01T00:00:00Z', 'A', 'B', '1 Elm', 13, '555', 'a@b.co')`,
      )
      .run();
    expect(res.meta.last_row_id).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to verify current state**

Run: `npm run test`
Expected: the three FK tests either PASS (D1 enforces FKs — the expected outcome) or FAIL with successful inserts. **If they FAIL because inserts succeed, STOP and report BLOCKED** — that changes Task 8's design (explicit existence checks would be required) and the controller must adjust the plan. The 21 pre-existing tests must stay green either way.

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/d1.ts tests/d1-schema.test.ts
git commit -m "test: D1 integration harness and foreign-key enforcement assertions"
```

---

### Task 2: Rate limiter — boundary test + D1 store integration test

**Files:**
- Create: `tests/rate-limit-stores.test.ts`
- Test-only task; `src/lib/rate-limit.ts` is NOT modified.

**Interfaces:**
- Consumes: `allowRequest`, `MemoryRateStore`, `D1RateStore` from `src/lib/rate-limit.ts`; `getTestDb` from Task 1.
- Produces: nothing new — closes two Plan 1 binding notes.

- [ ] **Step 1: Write the failing tests**

`tests/rate-limit-stores.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { allowRequest, MemoryRateStore, D1RateStore } from '../src/lib/rate-limit';
import { getTestDb } from './helpers/d1';

describe('fixed window boundary', () => {
  it('allows again exactly at windowStart + windowMs', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'k', 3, 60_000, 1_000);
    // 60_999 is still inside the window opened at 1_000; 61_000 is exactly the boundary.
    expect(await allowRequest(store, 'k', 3, 60_000, 60_999)).toBe(false);
    expect(await allowRequest(store, 'k', 3, 60_000, 61_000)).toBe(true);
  });
});

describe('D1RateStore against real local D1', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it('persists and updates records through the real rate_limits table', async () => {
    const store = new D1RateStore(db);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 1_000)).toBe(true);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 2_000)).toBe(true);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 3_000)).toBe(false);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 61_000)).toBe(true); // window reset
    const row = await db
      .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
      .bind('ip1')
      .first<{ window_start: number; count: number }>();
    expect(row).toEqual({ window_start: 61_000, count: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test`
Expected: all PASS (these test existing code paths — the boundary case was hand-verified in review but never automated; if the boundary test fails, that is a real bug: report it rather than adjusting the test).

- [ ] **Step 3: Commit**

```bash
git add tests/rate-limit-stores.test.ts
git commit -m "test: rate-limiter boundary case and D1 store integration"
```

---

### Task 3: sendEmail surfaces the Resend error body (TDD)

**Files:**
- Modify: `src/lib/email/send.ts` (the `if (!res.ok)` branch only)
- Test: `tests/email-send.test.ts`

**Interfaces:**
- Consumes: existing `sendEmail(env, to, email, replyTo?)`.
- Produces: same signature; on a non-2xx response the error string becomes `` `Resend responded ${status}: ${bodySnippet}` `` (body truncated to 300 chars; the `: …` part omitted when the body is empty/unreadable). Plan 3's admin screens will show this text to the operator.

- [ ] **Step 1: Write the failing tests**

`tests/email-send.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { sendEmail } from '../src/lib/email/send';

const env = { RESEND_API_KEY: 'k', EMAIL_FROM: 'f@x.co', EMAIL_REPLY_TO: 'r@x.co' };
const email = { subject: 's', html: '<p>h</p>', text: 't' };

afterEach(() => vi.unstubAllGlobals());

describe('sendEmail', () => {
  it('returns sent:true on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"id":"1"}', { status: 200 })));
    expect(await sendEmail(env, 'to@x.co', email)).toEqual({ sent: true });
  });

  it('includes the Resend error body detail on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"Domain not verified"}', { status: 403 })),
    );
    const r = await sendEmail(env, 'to@x.co', email);
    expect(r.sent).toBe(false);
    if (!r.sent) {
      expect(r.error).toContain('403');
      expect(r.error).toContain('Domain not verified');
    }
  });

  it('omits the detail suffix when the body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const r = await sendEmail(env, 'to@x.co', email);
    if (!r.sent) expect(r.error).toBe('Resend responded 500');
  });

  it('never throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    const r = await sendEmail(env, 'to@x.co', email);
    expect(r).toEqual({ sent: false, error: 'boom' });
  });
});
```

- [ ] **Step 2: Run tests to verify the detail test fails**

Run: `npm run test`
Expected: FAIL — "includes the Resend error body detail" (current code returns only the status). The other three pass already.

- [ ] **Step 3: Implement**

In `src/lib/email/send.ts`, replace the line `if (!res.ok) return { sent: false, error: \`Resend responded ${res.status}\` };` with:

```ts
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        // unreadable body: fall through with no detail
      }
      return {
        sent: false,
        error: `Resend responded ${res.status}${detail ? `: ${detail}` : ''}`,
      };
    }
```

- [ ] **Step 4: Run tests to verify all pass, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/email/send.ts tests/email-send.test.ts
git commit -m "feat: include Resend error body detail in sendEmail failures"
```

---

### Task 4: Application-received email template (TDD)

**Files:**
- Modify: `src/lib/email/render.ts` (append one function)
- Test: `tests/email-application-received.test.ts`

**Interfaces:**
- Consumes: `emailShell`, `escapeHtml`, `RenderedEmail` (same file).
- Produces: `renderApplicationReceivedEmail(firstName: string): RenderedEmail` — spec §8 template #1. Task 10 calls it on successful submission.

- [ ] **Step 1: Write the failing tests**

`tests/email-application-received.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderApplicationReceivedEmail } from '../src/lib/email/render';

describe('renderApplicationReceivedEmail', () => {
  it('has a PII-free subject', () => {
    const r = renderApplicationReceivedEmail('Sue');
    expect(r.subject).toBe('We received your Holiday Project application');
    expect(r.subject).not.toContain('Sue');
  });

  it('greets by first name (escaped) and explains what happens next', () => {
    const r = renderApplicationReceivedEmail('<Sue>');
    expect(r.html).toContain('&lt;Sue&gt;');
    expect(r.html).not.toContain('<Sue>');
    expect(r.html).toContain('volunteers');
    expect(r.html).toContain('608-723-2136 ext 1194');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `renderApplicationReceivedEmail` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/email/render.ts`:

```ts
export function renderApplicationReceivedEmail(firstName: string): RenderedEmail {
  const subject = 'We received your Holiday Project application';
  const bodyText = `Hello ${firstName},

We received your application — thank you. Here's what happens next:

1. Our volunteers will review your application.
2. You'll get an email from us when it has been reviewed.
3. If approved, you'll receive a pickup slip with your pickup date in December.

You don't need to do anything else right now. Your information is private and
is used only to prepare your family's gifts.

Questions? Call our message line at 608-723-2136 ext 1194 and leave your name
and phone number.`;
  const html = emailShell(
    'We received your application',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>We received your application — thank you. Here's what happens next:</p>
     <ol>
       <li>Our volunteers will review your application.</li>
       <li>You'll get an email from us when it has been reviewed.</li>
       <li>If approved, you'll receive a pickup slip with your pickup date in December.</li>
     </ol>
     <p>You don't need to do anything else right now. Your information is private
        and is used only to prepare your family's gifts.</p>
     <p>Questions? Call our message line at <strong>608-723-2136 ext 1194</strong>
        and leave your name and phone number.</p>`,
  );
  return { subject, html, text: bodyText };
}
```

- [ ] **Step 4: Run tests to verify all pass, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/email/render.ts tests/email-application-received.test.ts
git commit -m "feat: application-received email template"
```

---

### Task 5: Application validation — parsers, About you, bedding, good deed (TDD)

**Files:**
- Create: `src/lib/validation/application.ts`
- Test: `tests/application-validation-about.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (Task 6 extends this same file; Task 10 uses the final `validateApplication`):
  - `type ApplicationInput = Record<string, string>` — flattened FormData (checkbox present ⇒ `'on'`).
  - `type Errors = Record<string, string>` — keys are form field ids.
  - `parseMoney(raw: string): number | null` — accepts `12`, `12.5`, `12.50`, `$12.50`, `1,200`; returns null otherwise; never negative.
  - `parseIntInRange(raw: string, min: number, max: number): number | null`.
  - `type AboutClean = { firstName: string; lastName: string; address: string; cityId: number; phone: string; email: string; diabetic: boolean; permanentlyDisabled: boolean; shareWithSponsor: boolean; fullTimeResidenceConfirmed: boolean; yearsReceivedHelp: number; adoptedLastYear: boolean }`
  - `validateAbout(input: ApplicationInput, errors: Errors): AboutClean | null` — fills `errors`, returns null if any of its fields errored.
  - `type BeddingClean = { bedChoice: 'sheets' | 'blanket' | 'none'; bedSize: 'twin' | 'full' | 'queen' | 'king' | null }`
  - `validateBedding(input: ApplicationInput, errors: Errors): BeddingClean | null`
  - `validateGoodDeed(input: ApplicationInput, errors: Errors): string | null`

Form field names this module reads (Task 9's inputs must use these ids/names verbatim): `first_name`, `last_name`, `address`, `city_id`, `phone`, `email`, `email_confirm`, `diabetic`, `permanently_disabled` (`yes`/`no`), `share_with_sponsor`, `full_time_residence`, `years_received_help`, `adopted_last_year` (`yes`/`no`), `bed_choice` (`sheets`/`blanket`/`none`), `bed_size` (`twin`/`full`/`queen`/`king`), `good_deed`.

- [ ] **Step 1: Write the failing tests**

`tests/application-validation-about.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  parseIntInRange,
  validateAbout,
  validateBedding,
  validateGoodDeed,
  type Errors,
} from '../src/lib/validation/application';

const goodAbout = {
  first_name: 'Sue',
  last_name: 'Smith',
  address: '1 Elm St',
  city_id: '13',
  phone: '608-555-0100',
  email: 'sue@example.com',
  email_confirm: 'sue@example.com',
  permanently_disabled: 'no',
  full_time_residence: 'on',
  years_received_help: '0',
  adopted_last_year: 'no',
};

describe('parseMoney', () => {
  it('accepts plain and formatted amounts', () => {
    expect(parseMoney('12')).toBe(12);
    expect(parseMoney('12.5')).toBe(12.5);
    expect(parseMoney('$1,200.50')).toBe(1200.5);
    expect(parseMoney(' 0 ')).toBe(0);
  });
  it('rejects junk and negatives', () => {
    expect(parseMoney('twelve')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('12.345')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
});

describe('parseIntInRange', () => {
  it('parses within range', () => {
    expect(parseIntInRange('7', 0, 110)).toBe(7);
    expect(parseIntInRange('0', 0, 110)).toBe(0);
  });
  it('rejects out-of-range, decimals, junk', () => {
    expect(parseIntInRange('111', 0, 110)).toBeNull();
    expect(parseIntInRange('3.5', 0, 110)).toBeNull();
    expect(parseIntInRange('x', 0, 110)).toBeNull();
  });
});

describe('validateAbout', () => {
  it('returns clean data for a complete section', () => {
    const errors: Errors = {};
    const clean = validateAbout({ ...goodAbout, diabetic: 'on' }, errors);
    expect(errors).toEqual({});
    expect(clean).toEqual({
      firstName: 'Sue',
      lastName: 'Smith',
      address: '1 Elm St',
      cityId: 13,
      phone: '608-555-0100',
      email: 'sue@example.com',
      diabetic: true,
      permanentlyDisabled: false,
      shareWithSponsor: false,
      fullTimeResidenceConfirmed: true,
      yearsReceivedHelp: 0,
      adoptedLastYear: false,
    });
  });

  it('requires each required field with a kind message', () => {
    const errors: Errors = {};
    expect(validateAbout({}, errors)).toBeNull();
    for (const k of [
      'first_name', 'last_name', 'address', 'city_id', 'phone', 'email',
      'permanently_disabled', 'full_time_residence', 'years_received_help', 'adopted_last_year',
    ]) {
      expect(errors[k], `missing error for ${k}`).toBeTruthy();
    }
  });

  it('catches an email/confirm mismatch on email_confirm', () => {
    const errors: Errors = {};
    validateAbout({ ...goodAbout, email_confirm: 'sue@examp1e.com' }, errors);
    expect(errors.email_confirm).toContain('match');
  });

  it('catches a malformed email', () => {
    const errors: Errors = {};
    validateAbout({ ...goodAbout, email: 'not-an-email', email_confirm: 'not-an-email' }, errors);
    expect(errors.email).toBeTruthy();
  });

  it('treats years_received_help = 0 as valid (first year)', () => {
    const errors: Errors = {};
    const clean = validateAbout(goodAbout, errors);
    expect(clean?.yearsReceivedHelp).toBe(0);
  });
});

describe('validateBedding', () => {
  it('requires a choice', () => {
    const errors: Errors = {};
    expect(validateBedding({}, errors)).toBeNull();
    expect(errors.bed_choice).toBeTruthy();
  });
  it('requires a size unless choice is none', () => {
    const errors: Errors = {};
    expect(validateBedding({ bed_choice: 'blanket' }, errors)).toBeNull();
    expect(errors.bed_size).toBeTruthy();
    const e2: Errors = {};
    expect(validateBedding({ bed_choice: 'none' }, e2)).toEqual({ bedChoice: 'none', bedSize: null });
  });
  it('accepts a full selection and ignores size when none', () => {
    const e: Errors = {};
    expect(validateBedding({ bed_choice: 'sheets', bed_size: 'queen' }, e)).toEqual({
      bedChoice: 'sheets',
      bedSize: 'queen',
    });
    const e2: Errors = {};
    expect(validateBedding({ bed_choice: 'none', bed_size: 'queen' }, e2)).toEqual({
      bedChoice: 'none',
      bedSize: null,
    });
  });
});

describe('validateGoodDeed', () => {
  it('requires a deed and trims it', () => {
    const errors: Errors = {};
    expect(validateGoodDeed({ good_deed: '   ' }, errors)).toBeNull();
    expect(errors.good_deed).toBeTruthy();
    const e2: Errors = {};
    expect(validateGoodDeed({ good_deed: ' I shoveled snow. ' }, e2)).toBe('I shoveled snow.');
  });
  it('caps extreme length at 5000 characters', () => {
    const errors: Errors = {};
    expect(validateGoodDeed({ good_deed: 'x'.repeat(5001) }, errors)).toBeNull();
    expect(errors.good_deed).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/validation/application'`.

- [ ] **Step 3: Implement**

`src/lib/validation/application.ts`:

```ts
// Pure validation for the one-page application form (spec §3).
// Field names/ids match the form in src/pages/apply.astro exactly.
// Error messages are warm and specific: the audience is stressed,
// possibly elderly, non-technical applicants.

export type ApplicationInput = Record<string, string>;
export type Errors = Record<string, string>;

export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export function parseIntInRange(raw: string, min: number, max: number): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const get = (input: ApplicationInput, key: string): string => (input[key] ?? '').trim();
const isOn = (input: ApplicationInput, key: string): boolean => (input[key] ?? '') === 'on';

export type AboutClean = {
  firstName: string;
  lastName: string;
  address: string;
  cityId: number;
  phone: string;
  email: string;
  diabetic: boolean;
  permanentlyDisabled: boolean;
  shareWithSponsor: boolean;
  fullTimeResidenceConfirmed: boolean;
  yearsReceivedHelp: number;
  adoptedLastYear: boolean;
};

export function validateAbout(input: ApplicationInput, errors: Errors): AboutClean | null {
  const firstName = get(input, 'first_name');
  const lastName = get(input, 'last_name');
  const address = get(input, 'address');
  const phone = get(input, 'phone');
  const email = get(input, 'email');
  const emailConfirm = get(input, 'email_confirm');

  if (firstName === '') errors.first_name = 'Please tell us your first name.';
  if (lastName === '') errors.last_name = 'Please tell us your last name.';
  if (address === '') errors.address = 'Please tell us your street address.';

  const cityId = parseIntInRange(get(input, 'city_id'), 1, 9999);
  if (cityId === null) errors.city_id = 'Please pick your town from the list.';

  if (phone === '') errors.phone = 'We need your phone number so we can reach you about pickup.';

  if (email === '') {
    errors.email = 'Please enter your email address — we use it to send your approval.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "That email address doesn't look quite right — please check it.";
  }
  if (email !== '' && errors.email === undefined) {
    if (emailConfirm === '') {
      errors.email_confirm = 'Please type your email address again so we can be sure it’s right.';
    } else if (emailConfirm !== email) {
      errors.email_confirm = "These two email addresses don't match — please check them.";
    }
  }

  const disabled = get(input, 'permanently_disabled');
  if (disabled !== 'yes' && disabled !== 'no') {
    errors.permanently_disabled = 'Please answer yes or no.';
  }

  if (!isOn(input, 'full_time_residence')) {
    errors.full_time_residence =
      'Please check this box to confirm everyone you list lives at your address full-time.';
  }

  const years = parseIntInRange(get(input, 'years_received_help'), 0, 99);
  if (years === null) {
    errors.years_received_help =
      "Please enter how many years you've received help — enter 0 if this is your first year.";
  }

  const adopted = get(input, 'adopted_last_year');
  if (adopted !== 'yes' && adopted !== 'no') {
    errors.adopted_last_year = 'Please answer yes or no.';
  }

  const mine = [
    'first_name', 'last_name', 'address', 'city_id', 'phone', 'email', 'email_confirm',
    'permanently_disabled', 'full_time_residence', 'years_received_help', 'adopted_last_year',
  ];
  if (mine.some((k) => errors[k] !== undefined)) return null;

  return {
    firstName,
    lastName,
    address,
    cityId: cityId as number,
    phone,
    email,
    diabetic: isOn(input, 'diabetic'),
    permanentlyDisabled: disabled === 'yes',
    shareWithSponsor: isOn(input, 'share_with_sponsor'),
    fullTimeResidenceConfirmed: true,
    yearsReceivedHelp: years as number,
    adoptedLastYear: adopted === 'yes',
  };
}

export type BeddingClean = {
  bedChoice: 'sheets' | 'blanket' | 'none';
  bedSize: 'twin' | 'full' | 'queen' | 'king' | null;
};

export function validateBedding(input: ApplicationInput, errors: Errors): BeddingClean | null {
  const choice = get(input, 'bed_choice');
  if (choice !== 'sheets' && choice !== 'blanket' && choice !== 'none') {
    errors.bed_choice = 'Please choose sheets, a blanket, or "no thank you."';
    return null;
  }
  if (choice === 'none') return { bedChoice: 'none', bedSize: null };
  const size = get(input, 'bed_size');
  if (size !== 'twin' && size !== 'full' && size !== 'queen' && size !== 'king') {
    errors.bed_size = 'Please pick a size so we bring the right one.';
    return null;
  }
  return { bedChoice: choice, bedSize: size };
}

export function validateGoodDeed(input: ApplicationInput, errors: Errors): string | null {
  const deed = get(input, 'good_deed');
  if (deed === '') {
    errors.good_deed = 'Please tell us about one good deed — a sentence or two is plenty.';
    return null;
  }
  if (deed.length > 5000) {
    errors.good_deed = 'That’s a little long — please shorten it to the highlights.';
    return null;
  }
  return deed;
}
```

- [ ] **Step 4: Run tests to verify all pass, then commit**

Run: `npm run test` — Expected: all PASS, prior suite green.

```bash
git add src/lib/validation/application.ts tests/application-validation-about.test.ts
git commit -m "feat: application validation - parsers, about, bedding, good deed"
```

---

### Task 6: Application validation — employment, benefits, members, assembly (TDD)

**Files:**
- Modify: `src/lib/validation/application.ts` (append)
- Test: `tests/application-validation-household.test.ts`

**Interfaces:**
- Consumes: Task 5's exports (same file).
- Produces (Task 7 consumes `CleanApplication`; Task 10 consumes `validateApplication`):
  - `type EmployerClean = { employerName: string; workerName: string; hourlyWage: number; hoursPerWeek: number }`
  - `type BenefitsClean = { foodShareAmount: number | null; socialSecurityAmount: number | null; socialSecurityFor: string; ssiAmount: number | null; ssiFor: string; childSupportAmount: number | null; childSupportFor: string; unemploymentWeeklyAmount: number | null; unemploymentFor: string; otherIncomeAmount: number | null; otherIncomeFor: string }`
  - `type MemberClean = { name: string; relationship: string; sex: 'M' | 'F'; age: number; pants: string; shirtTop: string; underwear: string; socks: string; diapers: string; gifts: string }`
  - `type CleanApplication = AboutClean & BeddingClean & { noEmploymentConfirmed: boolean; employers: EmployerClean[]; benefits: BenefitsClean; members: MemberClean[]; goodDeed: string }`
  - `type ApplicationResult = { ok: true; spam: true } | { ok: true; spam: false; clean: CleanApplication } | { ok: false; errors: Errors }`
  - `validateApplication(input: ApplicationInput): ApplicationResult`
  - `MAX_MEMBERS = 15`, `MAX_EMPLOYERS = 10` (exported consts; Task 9/11 read them).

Row field names (N = 1-based index): employers `employer_name_N`, `worker_name_N`, `hourly_wage_N`, `hours_per_week_N` with `employer_count`; members `member_name_N`, `member_relationship_N`, `member_sex_N` (`M`/`F`), `member_age_N`, `member_pants_N`, `member_shirt_N`, `member_underwear_N`, `member_socks_N`, `member_diapers_N`, `member_gifts_N` with `member_count`. Benefits: `{key}_amount`, `{key}_none` (checkbox), `{key}_for` where key ∈ `food_share`, `social_security`, `ssi`, `child_support`, `unemployment`, `other_income` (`food_share` has no `_for`). `no_employment` checkbox. Honeypot: `website`.

**Forgiveness rule (important):** an employer row or member card whose fields are ALL blank is skipped silently — no error. This is what makes "Add another" recoverable without remove buttons. A partially-filled row gets errors on its missing fields. Member 1 may not be skipped (at least one member required).

- [ ] **Step 1: Write the failing tests**

`tests/application-validation-household.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateEmployment,
  validateBenefits,
  validateMembers,
  validateApplication,
  MAX_MEMBERS,
  MAX_EMPLOYERS,
  type Errors,
} from '../src/lib/validation/application';

const noBenefits = {
  food_share_none: 'on', social_security_none: 'on', ssi_none: 'on',
  child_support_none: 'on', unemployment_none: 'on', other_income_none: 'on',
};

const fullValid = {
  first_name: 'Sue', last_name: 'Smith', address: '1 Elm St', city_id: '13',
  phone: '608-555-0100', email: 'sue@example.com', email_confirm: 'sue@example.com',
  permanently_disabled: 'no', full_time_residence: 'on',
  years_received_help: '2', adopted_last_year: 'no',
  bed_choice: 'blanket', bed_size: 'queen',
  employer_count: '1', employer_name_1: 'Acme', worker_name_1: 'Sue Smith',
  hourly_wage_1: '15.50', hours_per_week_1: '32',
  ...noBenefits,
  member_count: '2',
  member_name_1: 'Sue Smith', member_relationship_1: 'self', member_sex_1: 'F', member_age_1: '34',
  member_name_2: 'Tim Smith', member_relationship_2: 'son', member_sex_2: 'M', member_age_2: '7',
  member_pants_2: '8', member_gifts_2: 'legos',
  good_deed: 'I shoveled my neighbor’s snow all winter.',
};

describe('validateEmployment', () => {
  it('accepts a complete employer row', () => {
    const errors: Errors = {};
    const r = validateEmployment(fullValid, errors);
    expect(errors).toEqual({});
    expect(r).toEqual({
      noEmploymentConfirmed: false,
      employers: [{ employerName: 'Acme', workerName: 'Sue Smith', hourlyWage: 15.5, hoursPerWeek: 32 }],
    });
  });

  it('requires either a job or the no-employment box', () => {
    const errors: Errors = {};
    expect(validateEmployment({ employer_count: '1' }, errors)).toBeNull();
    expect(errors.no_employment).toBeTruthy();
  });

  it('accepts the no-employment box with zero rows', () => {
    const errors: Errors = {};
    expect(validateEmployment({ employer_count: '1', no_employment: 'on' }, errors)).toEqual({
      noEmploymentConfirmed: true,
      employers: [],
    });
  });

  it('rejects the box AND a filled row together', () => {
    const errors: Errors = {};
    expect(validateEmployment({ ...fullValid, no_employment: 'on' }, errors)).toBeNull();
    expect(errors.no_employment).toContain('clear');
  });

  it('errors each missing field of a partially-filled row', () => {
    const errors: Errors = {};
    validateEmployment({ employer_count: '1', employer_name_1: 'Acme' }, errors);
    expect(errors.worker_name_1).toBeTruthy();
    expect(errors.hourly_wage_1).toBeTruthy();
    expect(errors.hours_per_week_1).toBeTruthy();
  });

  it('skips a fully blank extra row', () => {
    const errors: Errors = {};
    const r = validateEmployment({ ...fullValid, employer_count: '2' }, errors);
    expect(errors).toEqual({});
    expect(r?.employers).toHaveLength(1);
  });
});

describe('validateBenefits', () => {
  it('requires an answer for every benefit row', () => {
    const errors: Errors = {};
    expect(validateBenefits({}, errors)).toBeNull();
    for (const k of ['food_share', 'social_security', 'ssi', 'child_support', 'unemployment', 'other_income']) {
      expect(errors[`${k}_amount`], `missing error for ${k}`).toBeTruthy();
    }
  });

  it('requires who-receives-it when an amount is given (except food share)', () => {
    const errors: Errors = {};
    validateBenefits({ ...noBenefits, ssi_none: '', ssi_amount: '450' }, errors);
    expect(errors.ssi_for).toBeTruthy();
  });

  it('food share needs no for-whom', () => {
    const errors: Errors = {};
    const r = validateBenefits({ ...noBenefits, food_share_none: '', food_share_amount: '250' }, errors);
    expect(errors).toEqual({});
    expect(r?.foodShareAmount).toBe(250);
  });

  it('none-checked rows come back null with empty for', () => {
    const errors: Errors = {};
    const r = validateBenefits(noBenefits, errors);
    expect(r).toEqual({
      foodShareAmount: null,
      socialSecurityAmount: null, socialSecurityFor: '',
      ssiAmount: null, ssiFor: '',
      childSupportAmount: null, childSupportFor: '',
      unemploymentWeeklyAmount: null, unemploymentFor: '',
      otherIncomeAmount: null, otherIncomeFor: '',
    });
  });

  it('rejects an unparseable amount kindly', () => {
    const errors: Errors = {};
    validateBenefits({ ...noBenefits, ssi_none: '', ssi_amount: 'four hundred', ssi_for: 'me' }, errors);
    expect(errors.ssi_amount).toContain('number');
  });
});

describe('validateMembers', () => {
  it('accepts the two-member household and blank sizes mean not-needed', () => {
    const errors: Errors = {};
    const r = validateMembers(fullValid, errors);
    expect(errors).toEqual({});
    expect(r).toHaveLength(2);
    expect(r?.[0]).toMatchObject({ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 34, pants: '' });
    expect(r?.[1]).toMatchObject({ name: 'Tim Smith', age: 7, pants: '8', gifts: 'legos' });
  });

  it('requires person 1 even when blank', () => {
    const errors: Errors = {};
    expect(validateMembers({ member_count: '1' }, errors)).toBeNull();
    expect(errors.member_name_1).toBeTruthy();
    expect(errors.member_relationship_1).toBeTruthy();
    expect(errors.member_sex_1).toBeTruthy();
    expect(errors.member_age_1).toBeTruthy();
  });

  it('skips a fully blank extra card but errors a partial one', () => {
    const e1: Errors = {};
    const r1 = validateMembers({ ...fullValid, member_count: '3' }, e1);
    expect(e1).toEqual({});
    expect(r1).toHaveLength(2);
    const e2: Errors = {};
    validateMembers({ ...fullValid, member_count: '3', member_name_3: 'Baby' }, e2);
    expect(e2.member_age_3).toBeTruthy();
  });

  it('rejects an age outside 0-110', () => {
    const errors: Errors = {};
    validateMembers({ ...fullValid, member_age_2: '190' }, errors);
    expect(errors.member_age_2).toBeTruthy();
  });
});

describe('validateApplication', () => {
  it('returns spam for a filled honeypot', () => {
    expect(validateApplication({ ...fullValid, website: 'http://spam' })).toEqual({ ok: true, spam: true });
  });

  it('assembles a clean application from valid input', () => {
    const r = validateApplication(fullValid);
    expect(r.ok).toBe(true);
    if (r.ok && !r.spam) {
      expect(r.clean.firstName).toBe('Sue');
      expect(r.clean.bedChoice).toBe('blanket');
      expect(r.clean.employers).toHaveLength(1);
      expect(r.clean.members).toHaveLength(2);
      expect(r.clean.benefits.ssiAmount).toBeNull();
      expect(r.clean.goodDeed).toContain('shoveled');
    }
  });

  it('collects errors across all sections at once', () => {
    const r = validateApplication({ member_count: '1', employer_count: '1' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.first_name).toBeTruthy();
      expect(r.errors.bed_choice).toBeTruthy();
      expect(r.errors.no_employment).toBeTruthy();
      expect(r.errors.food_share_amount).toBeTruthy();
      expect(r.errors.member_name_1).toBeTruthy();
      expect(r.errors.good_deed).toBeTruthy();
    }
  });

  it('clamps runaway counts', () => {
    const r = validateApplication({ ...fullValid, member_count: '9999', employer_count: '9999' });
    expect(r.ok).toBe(true);
    expect(MAX_MEMBERS).toBe(15);
    expect(MAX_EMPLOYERS).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `validateEmployment` (etc.) not exported. Task 5 tests stay green.

- [ ] **Step 3: Implement**

Append to `src/lib/validation/application.ts`:

```ts
export const MAX_MEMBERS = 15;
export const MAX_EMPLOYERS = 10;

function rowCount(input: ApplicationInput, key: string, max: number): number {
  // Clamp rather than reset: a tampered count never hides rows someone typed.
  const n = Number((input[key] ?? '1').trim());
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, max);
}

export type EmployerClean = {
  employerName: string;
  workerName: string;
  hourlyWage: number;
  hoursPerWeek: number;
};

export function validateEmployment(
  input: ApplicationInput,
  errors: Errors,
): { noEmploymentConfirmed: boolean; employers: EmployerClean[] } | null {
  const count = rowCount(input, 'employer_count', MAX_EMPLOYERS);
  const noEmployment = isOn(input, 'no_employment');
  const employers: EmployerClean[] = [];
  let rowErrors = false;

  for (let i = 1; i <= count; i++) {
    const name = get(input, `employer_name_${i}`);
    const worker = get(input, `worker_name_${i}`);
    const wageRaw = get(input, `hourly_wage_${i}`);
    const hoursRaw = get(input, `hours_per_week_${i}`);
    if (name === '' && worker === '' && wageRaw === '' && hoursRaw === '') continue; // blank row: skip

    if (name === '') errors[`employer_name_${i}`] = 'Please tell us the employer’s name.';
    if (worker === '') errors[`worker_name_${i}`] = 'Please tell us who works this job.';
    const wage = parseMoney(wageRaw);
    if (wage === null)
      errors[`hourly_wage_${i}`] = 'Please enter the hourly wage as a number, like 15.50.';
    const hours = parseMoney(hoursRaw);
    if (hours === null || hours > 168)
      errors[`hours_per_week_${i}`] = 'Please enter hours per week as a number, like 32.';

    if (
      errors[`employer_name_${i}`] || errors[`worker_name_${i}`] ||
      errors[`hourly_wage_${i}`] || errors[`hours_per_week_${i}`]
    ) {
      rowErrors = true;
      continue;
    }
    employers.push({
      employerName: name,
      workerName: worker,
      hourlyWage: wage as number,
      hoursPerWeek: hours as number,
    });
  }

  if (noEmployment && (employers.length > 0 || rowErrors)) {
    errors.no_employment =
      'You’ve checked "no one is employed" but also listed a job — please clear one or the other.';
    return null;
  }
  if (!noEmployment && employers.length === 0 && !rowErrors) {
    errors.no_employment =
      'Please list at least one job, or check the box that says no one in your household is employed.';
    return null;
  }
  if (rowErrors) return null;
  return { noEmploymentConfirmed: noEmployment, employers };
}

export type BenefitsClean = {
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
};

const BENEFIT_KEYS = [
  { key: 'food_share', hasFor: false },
  { key: 'social_security', hasFor: true },
  { key: 'ssi', hasFor: true },
  { key: 'child_support', hasFor: true },
  { key: 'unemployment', hasFor: true },
  { key: 'other_income', hasFor: true },
] as const;

export function validateBenefits(input: ApplicationInput, errors: Errors): BenefitsClean | null {
  const out: Record<string, number | null | string> = {};
  let failed = false;

  for (const { key, hasFor } of BENEFIT_KEYS) {
    const none = isOn(input, `${key}_none`);
    const amountRaw = get(input, `${key}_amount`);
    const forWhom = get(input, `${key}_for`);
    let amount: number | null = null;

    if (none) {
      amount = null;
    } else if (amountRaw === '') {
      errors[`${key}_amount`] =
        'Please enter an amount, or check the box that says you don’t receive this.';
      failed = true;
    } else {
      const parsed = parseMoney(amountRaw);
      if (parsed === null) {
        errors[`${key}_amount`] = 'Please enter the amount as a number, like 250 — no letters needed.';
        failed = true;
      } else {
        amount = parsed;
        if (hasFor && forWhom === '') {
          errors[`${key}_for`] = 'Please tell us who in your household receives this.';
          failed = true;
        }
      }
    }
    out[`${key}_amount`] = amount;
    out[`${key}_for`] = none ? '' : forWhom;
  }
  if (failed) return null;

  return {
    foodShareAmount: out.food_share_amount as number | null,
    socialSecurityAmount: out.social_security_amount as number | null,
    socialSecurityFor: out.social_security_for as string,
    ssiAmount: out.ssi_amount as number | null,
    ssiFor: out.ssi_for as string,
    childSupportAmount: out.child_support_amount as number | null,
    childSupportFor: out.child_support_for as string,
    unemploymentWeeklyAmount: out.unemployment_amount as number | null,
    unemploymentFor: out.unemployment_for as string,
    otherIncomeAmount: out.other_income_amount as number | null,
    otherIncomeFor: out.other_income_for as string,
  };
}

export type MemberClean = {
  name: string;
  relationship: string;
  sex: 'M' | 'F';
  age: number;
  pants: string;
  shirtTop: string;
  underwear: string;
  socks: string;
  diapers: string;
  gifts: string;
};

export function validateMembers(input: ApplicationInput, errors: Errors): MemberClean[] | null {
  const count = rowCount(input, 'member_count', MAX_MEMBERS);
  const members: MemberClean[] = [];
  let failed = false;

  for (let i = 1; i <= count; i++) {
    const name = get(input, `member_name_${i}`);
    const relationship = get(input, `member_relationship_${i}`);
    const sex = get(input, `member_sex_${i}`);
    const ageRaw = get(input, `member_age_${i}`);
    const sizes = {
      pants: get(input, `member_pants_${i}`),
      shirtTop: get(input, `member_shirt_${i}`),
      underwear: get(input, `member_underwear_${i}`),
      socks: get(input, `member_socks_${i}`),
      diapers: get(input, `member_diapers_${i}`),
    };
    const gifts = get(input, `member_gifts_${i}`);

    const allBlank =
      name === '' && relationship === '' && sex === '' && ageRaw === '' &&
      Object.values(sizes).every((s) => s === '') && gifts === '';
    if (allBlank && i > 1) continue; // blank extra card: skip

    if (name === '') errors[`member_name_${i}`] = 'Please give this person’s first and last name.';
    if (relationship === '')
      errors[`member_relationship_${i}`] = 'Please tell us how they’re related to you (write "self" for yourself).';
    if (sex !== 'M' && sex !== 'F') errors[`member_sex_${i}`] = 'Please pick one.';
    const age = parseIntInRange(ageRaw, 0, 110);
    if (age === null) errors[`member_age_${i}`] = 'Please enter their age as a number.';

    if (
      errors[`member_name_${i}`] || errors[`member_relationship_${i}`] ||
      errors[`member_sex_${i}`] || errors[`member_age_${i}`]
    ) {
      failed = true;
      continue;
    }
    members.push({ name, relationship, sex: sex as 'M' | 'F', age: age as number, ...sizes, gifts });
  }

  if (failed) return null;
  return members;
}

export type CleanApplication = AboutClean &
  BeddingClean & {
    noEmploymentConfirmed: boolean;
    employers: EmployerClean[];
    benefits: BenefitsClean;
    members: MemberClean[];
    goodDeed: string;
  };

export type ApplicationResult =
  | { ok: true; spam: true }
  | { ok: true; spam: false; clean: CleanApplication }
  | { ok: false; errors: Errors };

export function validateApplication(input: ApplicationInput): ApplicationResult {
  if ((input.website ?? '').trim() !== '') return { ok: true, spam: true };

  const errors: Errors = {};
  const about = validateAbout(input, errors);
  const bedding = validateBedding(input, errors);
  const employment = validateEmployment(input, errors);
  const benefits = validateBenefits(input, errors);
  const members = validateMembers(input, errors);
  const goodDeed = validateGoodDeed(input, errors);

  if (!about || !bedding || !employment || !benefits || !members || goodDeed === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    spam: false,
    clean: { ...about, ...bedding, ...employment, benefits, members, goodDeed },
  };
}
```

- [ ] **Step 4: Run tests to verify all pass, then commit**

Run: `npm run test` — Expected: all PASS (both validation files + prior suite).

```bash
git add src/lib/validation/application.ts tests/application-validation-household.test.ts
git commit -m "feat: application validation - employment, benefits, members, assembly"
```

---

### Task 7: Eligibility flag + household-type suggestion (TDD)

**Files:**
- Create: `src/lib/eligibility.ts`
- Test: `tests/eligibility.test.ts`

**Interfaces:**
- Consumes: `CleanApplication` type (structurally — only `permanentlyDisabled` and `members`).
- Produces (Task 10 consumes both):
  - `mayNotBeEligible(app: { permanentlyDisabled: boolean; members: { age: number }[] }): boolean` — spec §3 formula: no member under 18 AND person 1 under 65 AND not permanently disabled. Never blocks; informational flag.
  - `suggestHouseholdType(app: { permanentlyDisabled: boolean; members: { age: number }[] }): 'family' | 'elderly' | 'disabled'` — spec §3: disabled if permanently disabled; else elderly if person 1 ≥ 65; else family.

- [ ] **Step 1: Write the failing tests**

`tests/eligibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mayNotBeEligible, suggestHouseholdType } from '../src/lib/eligibility';

const app = (ages: number[], disabled = false) => ({
  permanentlyDisabled: disabled,
  members: ages.map((age) => ({ age })),
});

describe('mayNotBeEligible', () => {
  it('family with a child is eligible', () => {
    expect(mayNotBeEligible(app([34, 7]))).toBe(false);
  });
  it('senior head (65+) without children is eligible', () => {
    expect(mayNotBeEligible(app([65]))).toBe(false);
  });
  it('disabled household without children is eligible', () => {
    expect(mayNotBeEligible(app([40], true))).toBe(false);
  });
  it('under-65 adults only, not disabled: flagged', () => {
    expect(mayNotBeEligible(app([40, 42]))).toBe(true);
  });
  it('17-year-old member counts as a child', () => {
    expect(mayNotBeEligible(app([40, 17]))).toBe(false);
  });
  it('64-year-old head without children: flagged', () => {
    expect(mayNotBeEligible(app([64]))).toBe(true);
  });
});

describe('suggestHouseholdType', () => {
  it('disabled wins over everything', () => {
    expect(suggestHouseholdType(app([70, 5], true))).toBe('disabled');
  });
  it('elderly when person 1 is 65+', () => {
    expect(suggestHouseholdType(app([65]))).toBe('elderly');
  });
  it('family otherwise', () => {
    expect(suggestHouseholdType(app([34, 7]))).toBe('family');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/eligibility'`.

- [ ] **Step 3: Implement**

`src/lib/eligibility.ts`:

```ts
// Eligibility is NEVER enforced by the form (owner decision 2026-07-12):
// the flag only marks applications for the admin's human review.

type HouseholdShape = { permanentlyDisabled: boolean; members: { age: number }[] };

export function mayNotBeEligible(app: HouseholdShape): boolean {
  const hasChild = app.members.some((m) => m.age < 18);
  const headIsSenior = (app.members[0]?.age ?? 0) >= 65;
  return !hasChild && !headIsSenior && !app.permanentlyDisabled;
}

export function suggestHouseholdType(app: HouseholdShape): 'family' | 'elderly' | 'disabled' {
  if (app.permanentlyDisabled) return 'disabled';
  if ((app.members[0]?.age ?? 0) >= 65) return 'elderly';
  return 'family';
}
```

- [ ] **Step 4: Run tests to verify all pass, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/eligibility.ts tests/eligibility.test.ts
git commit -m "feat: eligibility flag and household-type suggestion"
```

---

### Task 8: db helpers — listCities + insertApplication (integration TDD)

**Files:**
- Modify: `src/lib/db.ts` (append; do not touch existing exports)
- Test: `tests/db-application.test.ts`

**Interfaces:**
- Consumes: `getTestDb` (Task 1), `CleanApplication` (Task 6), schema tables.
- Produces (Task 9 uses `listCities`; Task 10 uses `insertApplication`):
  - `type City = { id: number; name: string }`
  - `listCities(db: D1Database): Promise<City[]>` — ordered by name.
  - `type NewApplication = CleanApplication & { seasonYear: number; submittedAt: string; mayNotBeEligible: boolean; householdType: 'family' | 'elderly' | 'disabled' }`
  - `insertApplication(db: D1Database, app: NewApplication): Promise<number>` — inserts the application row plus all member and employer rows; returns the new application id. Status defaults to `'new'` via the schema.

- [ ] **Step 1: Write the failing tests**

`tests/db-application.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { listCities, insertApplication, type NewApplication } from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm St', cityId: 13,
  phone: '608-555-0100', email: 'sue@example.com',
  diabetic: true, permanentlyDisabled: false, shareWithSponsor: true,
  fullTimeResidenceConfirmed: true, yearsReceivedHelp: 2, adoptedLastYear: false,
  bedChoice: 'blanket', bedSize: 'queen',
  noEmploymentConfirmed: false,
  employers: [{ employerName: 'Acme', workerName: 'Sue Smith', hourlyWage: 15.5, hoursPerWeek: 32 }],
  benefits: {
    foodShareAmount: 250,
    socialSecurityAmount: null, socialSecurityFor: '',
    ssiAmount: 450, ssiFor: 'Sue',
    childSupportAmount: null, childSupportFor: '',
    unemploymentWeeklyAmount: null, unemploymentFor: '',
    otherIncomeAmount: null, otherIncomeFor: '',
  },
  members: [
    { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 34, pants: '', shirtTop: 'M', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '8', shirtTop: '8', underwear: '8', socks: '3', diapers: '', gifts: 'legos' },
  ],
  goodDeed: 'I shoveled snow.',
  seasonYear: 2026, submittedAt: '2026-10-02T15:00:00.000Z',
  mayNotBeEligible: false, householdType: 'family',
};

describe('application db helpers', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it('listCities returns the seeded city', async () => {
    expect(await listCities(db)).toEqual([{ id: 13, name: 'Lancaster' }]);
  });

  it('insertApplication writes the application, members, and employers', async () => {
    const id = await insertApplication(db, app);
    expect(id).toBeGreaterThan(0);

    const row = await db.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first<any>();
    expect(row.first_name).toBe('Sue');
    expect(row.status).toBe('new');
    expect(row.season_year).toBe(2026);
    expect(row.diabetic).toBe(1);
    expect(row.bed_size).toBe('queen');
    expect(row.ssi_amount).toBe(450);
    expect(row.ssi_for).toBe('Sue');
    expect(row.social_security_amount).toBeNull();
    expect(row.may_not_be_eligible).toBe(0);
    expect(row.household_type).toBe('family');
    expect(row.pu_number).toBeNull();

    const members = await db
      .prepare('SELECT * FROM household_members WHERE application_id = ? ORDER BY position')
      .bind(id).all<any>();
    expect(members.results).toHaveLength(2);
    expect(members.results[0]).toMatchObject({ position: 1, name: 'Sue Smith', relationship: 'self' });
    expect(members.results[1]).toMatchObject({ position: 2, age: 7, gifts: 'legos' });

    const employers = await db
      .prepare('SELECT * FROM employers WHERE application_id = ?').bind(id).all<any>();
    expect(employers.results).toHaveLength(1);
    expect(employers.results[0]).toMatchObject({ employer_name: 'Acme', hourly_wage: 15.5 });
  });

  it('stores bed_size as NULL when the choice is none', async () => {
    const id = await insertApplication(db, { ...app, bedChoice: 'none', bedSize: null });
    const row = await db.prepare('SELECT bed_choice, bed_size FROM applications WHERE id = ?').bind(id).first<any>();
    expect(row).toEqual({ bed_choice: 'none', bed_size: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `listCities`/`insertApplication` not exported from `../src/lib/db`.

- [ ] **Step 3: Implement**

Append to `src/lib/db.ts`:

```ts
import type { CleanApplication } from './validation/application';

export type City = { id: number; name: string };

export async function listCities(db: D1Database): Promise<City[]> {
  const { results } = await db.prepare('SELECT id, name FROM cities ORDER BY name').all<City>();
  return results;
}

export type NewApplication = CleanApplication & {
  seasonYear: number;
  submittedAt: string;
  mayNotBeEligible: boolean;
  householdType: 'family' | 'elderly' | 'disabled';
};

export async function insertApplication(db: D1Database, app: NewApplication): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO applications (
         season_year, submitted_at, first_name, last_name, address, city_id, phone, email,
         diabetic, share_with_sponsor, permanently_disabled, bed_choice, bed_size,
         full_time_residence_confirmed, years_received_help, adopted_last_year, household_type,
         no_employment_confirmed,
         food_share_amount,
         social_security_amount, social_security_for,
         ssi_amount, ssi_for,
         child_support_amount, child_support_for,
         unemployment_weekly_amount, unemployment_for,
         other_income_amount, other_income_for,
         good_deed, may_not_be_eligible
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      app.seasonYear, app.submittedAt, app.firstName, app.lastName, app.address, app.cityId,
      app.phone, app.email,
      app.diabetic ? 1 : 0, app.shareWithSponsor ? 1 : 0, app.permanentlyDisabled ? 1 : 0,
      app.bedChoice, app.bedSize,
      app.fullTimeResidenceConfirmed ? 1 : 0, app.yearsReceivedHelp, app.adoptedLastYear ? 1 : 0,
      app.householdType,
      app.noEmploymentConfirmed ? 1 : 0,
      app.benefits.foodShareAmount,
      app.benefits.socialSecurityAmount, app.benefits.socialSecurityFor,
      app.benefits.ssiAmount, app.benefits.ssiFor,
      app.benefits.childSupportAmount, app.benefits.childSupportFor,
      app.benefits.unemploymentWeeklyAmount, app.benefits.unemploymentFor,
      app.benefits.otherIncomeAmount, app.benefits.otherIncomeFor,
      app.goodDeed, app.mayNotBeEligible ? 1 : 0,
    )
    .run();

  const appId = res.meta.last_row_id as number;

  const statements = [
    ...app.members.map((m, i) =>
      db
        .prepare(
          `INSERT INTO household_members
             (application_id, position, name, relationship, sex, age, pants, shirt_top, underwear, socks, diapers, gifts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(appId, i + 1, m.name, m.relationship, m.sex, m.age, m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.gifts),
    ),
    ...app.employers.map((e) =>
      db
        .prepare(
          `INSERT INTO employers (application_id, employer_name, worker_name, hourly_wage, hours_per_week)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(appId, e.employerName, e.workerName, e.hourlyWage, e.hoursPerWeek),
    ),
  ];
  if (statements.length > 0) await db.batch(statements);

  return appId;
}
```

- [ ] **Step 4: Run tests to verify all pass, then commit**

Run: `npm run test` — Expected: all PASS.

```bash
git add src/lib/db.ts tests/db-application.test.ts
git commit -m "feat: listCities and insertApplication db helpers"
```

---

### Task 9: Apply page — components, season gate, GET render

**Files:**
- Create: `src/components/apply/FieldError.astro`, `src/components/apply/EmployerRow.astro`, `src/components/apply/MemberCard.astro`, `src/components/apply/BenefitRow.astro`
- Modify: `src/pages/apply.astro` (full replacement of the Plan 1 stub)

**Interfaces:**
- Consumes: `getSettings`, `listCities` (db.ts); `newCsrfCookieValue`, `csrfTokenFor` (csrf.ts); `MAX_MEMBERS`, `MAX_EMPLOYERS` (validation module); `Site` layout.
- Produces: `/apply` GET — the closed page when `applications_open` is 0, the full blank form when 1. POST is wired in Task 10; until then the frontmatter treats POST like GET (renders the form; no processing). Components take `(index, values, errors)` and are reused verbatim by Task 10's re-renders and Task 11's templates. Shared prop types: `values: Record<string, string>`, `errors: Record<string, string>`.
- The `v(name)` convention: every input's `value` comes from `values[name] ?? ''` so any re-render preserves typing.

- [ ] **Step 1: Write the field-error helper component**

`src/components/apply/FieldError.astro`:

```astro
---
interface Props { id: string; errors: Record<string, string> }
const { id, errors } = Astro.props;
---
{errors[id] && <p id={`${id}-error`} class="mt-1 font-semibold text-berry-800">{errors[id]}</p>}
```

- [ ] **Step 2: Write the employer row component**

`src/components/apply/EmployerRow.astro`:

```astro
---
import FieldError from './FieldError.astro';
interface Props { index: number | string; values: Record<string, string>; errors: Record<string, string> }
const { index: i, values, errors } = Astro.props;
const v = (n: string) => values[n] ?? '';
const inv = (n: string) => (errors[n] ? 'true' : undefined);
const desc = (n: string) => (errors[n] ? `${n}-error` : undefined);
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3';
---
<fieldset class="mt-4 rounded border-2 border-stone-300 bg-white p-4">
  <legend class="px-2 font-bold">Job {i}</legend>
  <div class="grid gap-4 sm:grid-cols-2">
    <div>
      <label for={`employer_name_${i}`} class="block font-semibold">Employer's name</label>
      <input type="text" id={`employer_name_${i}`} name={`employer_name_${i}`} value={v(`employer_name_${i}`)}
        aria-invalid={inv(`employer_name_${i}`)} aria-describedby={desc(`employer_name_${i}`)} class={input} />
      <FieldError id={`employer_name_${i}`} errors={errors} />
    </div>
    <div>
      <label for={`worker_name_${i}`} class="block font-semibold">Who works this job?</label>
      <input type="text" id={`worker_name_${i}`} name={`worker_name_${i}`} value={v(`worker_name_${i}`)}
        aria-invalid={inv(`worker_name_${i}`)} aria-describedby={desc(`worker_name_${i}`)} class={input} />
      <FieldError id={`worker_name_${i}`} errors={errors} />
    </div>
    <div>
      <label for={`hourly_wage_${i}`} class="block font-semibold">Hourly wage (dollars)</label>
      <input type="text" inputmode="decimal" id={`hourly_wage_${i}`} name={`hourly_wage_${i}`} value={v(`hourly_wage_${i}`)}
        aria-invalid={inv(`hourly_wage_${i}`)} aria-describedby={desc(`hourly_wage_${i}`)} class={input} />
      <FieldError id={`hourly_wage_${i}`} errors={errors} />
    </div>
    <div>
      <label for={`hours_per_week_${i}`} class="block font-semibold">Hours worked per week</label>
      <input type="text" inputmode="decimal" id={`hours_per_week_${i}`} name={`hours_per_week_${i}`} value={v(`hours_per_week_${i}`)}
        aria-invalid={inv(`hours_per_week_${i}`)} aria-describedby={desc(`hours_per_week_${i}`)} class={input} />
      <FieldError id={`hours_per_week_${i}`} errors={errors} />
    </div>
  </div>
</fieldset>
```

- [ ] **Step 3: Write the member card component**

`src/components/apply/MemberCard.astro`:

```astro
---
import FieldError from './FieldError.astro';
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
      <label for={`member_relationship_${i}`} class="block font-semibold">
        How are they related to you? <span class="font-normal">(write "self" for yourself)</span>
      </label>
      <input type="text" id={`member_relationship_${i}`} name={`member_relationship_${i}`} value={v(`member_relationship_${i}`)}
        aria-invalid={inv(`member_relationship_${i}`)} aria-describedby={desc(`member_relationship_${i}`)} class={input} />
      <FieldError id={`member_relationship_${i}`} errors={errors} />
    </div>
    <fieldset>
      <legend id={`member_sex_${i}`} class="font-semibold">Sex</legend>
      <div class="mt-1 flex gap-6">
        <label class="flex items-center gap-2"><input type="radio" name={`member_sex_${i}`} value="M" checked={v(`member_sex_${i}`) === 'M'} class="h-6 w-6" /> Male</label>
        <label class="flex items-center gap-2"><input type="radio" name={`member_sex_${i}`} value="F" checked={v(`member_sex_${i}`) === 'F'} class="h-6 w-6" /> Female</label>
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
  </div>
</fieldset>
```

- [ ] **Step 4: Write the benefit row component**

`src/components/apply/BenefitRow.astro`:

```astro
---
import FieldError from './FieldError.astro';
interface Props {
  benefitKey: string; label: string; period: string; hasFor: boolean;
  values: Record<string, string>; errors: Record<string, string>;
}
const { benefitKey: k, label, period, hasFor, values, errors } = Astro.props;
const v = (n: string) => values[n] ?? '';
const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3';
---
<fieldset class="mt-4 rounded border-2 border-stone-300 bg-white p-4">
  <legend class="px-2 font-bold">{label}</legend>
  <div class="grid gap-4 sm:grid-cols-2">
    <div>
      <label for={`${k}_amount`} class="block font-semibold">{period} amount (dollars)</label>
      <input type="text" inputmode="decimal" id={`${k}_amount`} name={`${k}_amount`} value={v(`${k}_amount`)}
        aria-invalid={errors[`${k}_amount`] ? 'true' : undefined}
        aria-describedby={errors[`${k}_amount`] ? `${k}_amount-error` : undefined} class={input} />
      <FieldError id={`${k}_amount`} errors={errors} />
    </div>
    {hasFor && (
      <div>
        <label for={`${k}_for`} class="block font-semibold">Who receives it?</label>
        <input type="text" id={`${k}_for`} name={`${k}_for`} value={v(`${k}_for`)}
          aria-invalid={errors[`${k}_for`] ? 'true' : undefined}
          aria-describedby={errors[`${k}_for`] ? `${k}_for-error` : undefined} class={input} />
        <FieldError id={`${k}_for`} errors={errors} />
      </div>
    )}
  </div>
  <label class="mt-3 flex items-center gap-3">
    <input type="checkbox" name={`${k}_none`} checked={v(`${k}_none`) === 'on'} class="h-6 w-6" />
    <span>We don't receive this</span>
  </label>
</fieldset>
```

- [ ] **Step 5: Replace `src/pages/apply.astro`**

Full replacement (POST processing arrives in Task 10 — for now every request renders; the structure below is final):

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
import EmployerRow from '../components/apply/EmployerRow.astro';
import MemberCard from '../components/apply/MemberCard.astro';
import BenefitRow from '../components/apply/BenefitRow.astro';
import FieldError from '../components/apply/FieldError.astro';
import { getSettings, listCities } from '../lib/db';
import { newCsrfCookieValue, csrfTokenFor } from '../lib/csrf';
import { MAX_MEMBERS, MAX_EMPLOYERS } from '../lib/validation/application';
export const prerender = false;

const env = Astro.locals.runtime.env;
const settings = await getSettings(env.DB);
const open = settings.applications_open === 1;

// On a fresh GET, Person 1's relationship arrives prefilled as "self"
// (spec §3: person 1 is the applicant). POST re-renders overwrite this.
let values: Record<string, string> = { member_relationship_1: 'self' };
let errors: Record<string, string> = {};
let retryNote = '';
let rateNote = '';

// Task 10 fills in POST handling here.

const memberCount = Math.min(Math.max(Number(values.member_count) || 1, 1), MAX_MEMBERS);
const employerCount = Math.min(Math.max(Number(values.employer_count) || 1, 1), MAX_EMPLOYERS);

const cities = open ? await listCities(env.DB) : [];

// Reuse a well-formed csrf cookie (keeps a second open tab's token valid).
const existingCsrf = Astro.cookies.get('csrf')?.value ?? '';
const cookieValue = /^[0-9a-f]{64}$/.test(existingCsrf) ? existingCsrf : newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, { httpOnly: true, sameSite: 'lax', path: '/', secure: true });
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);

const input = 'mt-1 w-full rounded border-2 border-stone-400 bg-white p-3';
const errorEntries = Object.entries(errors);
---
<Site title="Apply">
  {!open ? (
    <>
      <h1 class="text-3xl font-bold text-holly-800">Apply for Holiday Help</h1>
      <p class="mt-4">
        Applications are closed right now. They open on <strong>October 1</strong> each year, and
        the online application will be right here when they do.
      </p>
      <div class="mt-6 rounded border-l-4 border-berry-700 bg-white p-4">
        <h2 class="text-xl font-bold text-holly-800">You can always reach us these two ways:</h2>
        <ul class="mt-2 list-disc space-y-2 pl-6">
          <li>
            <strong>By phone:</strong> call our message line at <strong>608-723-2136 ext 1194</strong>.
            Speak slowly and leave your name, address, and whether you are a family or elderly household.
          </li>
          <li>
            <strong>On paper:</strong>
            <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a>
            and mail it to 235 W. Elm St., Lancaster WI 53813.
          </li>
        </ul>
      </div>
      <p class="mt-6">Your information is always private. We use it only to prepare your family's gifts.</p>
    </>
  ) : (
    <>
      <h1 class="text-3xl font-bold text-holly-800">Apply for Holiday Help</h1>

      <p class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4">
        <strong>Your answers are private.</strong> We use them only to prepare your family's gifts,
        and we never share your name with donors or sponsors without your permission.
      </p>

      <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4">
        <p><strong>Rather not do this online?</strong> That's just fine:</p>
        <ul class="mt-2 list-disc space-y-1 pl-6">
          <li>Call our message line at <strong>608-723-2136 ext 1194</strong> and we'll mail you a paper application.</li>
          <li>Or <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a> and mail it to 235 W. Elm St., Lancaster WI 53813.</li>
        </ul>
      </div>

      <p class="mt-4">
        A note on who this program serves: it's for Grant County households with children, and for
        adults who are over 65 or permanently disabled. If you're not sure whether that's you,
        apply anyway — a volunteer will look at your application with care.
      </p>

      {retryNote !== '' && (
        <div class="mt-4 rounded border-l-4 border-holly-700 bg-white p-4" role="status">
          <p class="font-semibold">{retryNote}</p>
        </div>
      )}
      {rateNote !== '' && (
        <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4" role="status">
          <p class="font-semibold">{rateNote}</p>
        </div>
      )}
      {errorEntries.length > 0 && (
        <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4" role="alert">
          <p class="font-bold">Almost there — please check these {errorEntries.length} things:</p>
          <ul class="mt-1 list-disc pl-6">
            {errorEntries.map(([field, msg]) => (
              <li><a href={`#${field}`} class="text-berry-700 underline">{msg}</a></li>
            ))}
          </ul>
        </div>
      )}

      <form method="post" class="mt-6 space-y-10" novalidate>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="member_count" value={String(memberCount)} />
        <input type="hidden" name="employer_count" value={String(employerCount)} />
        <p class="hidden" aria-hidden="true">
          <label>Leave this box empty: <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
        </p>

        <section aria-labelledby="s-about">
          <h2 id="s-about" class="text-2xl font-bold text-holly-800">About you</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label for="first_name" class="block font-semibold">First name</label>
              <input type="text" id="first_name" name="first_name" value={values.first_name ?? ''} autocomplete="given-name"
                aria-invalid={errors.first_name ? 'true' : undefined} aria-describedby={errors.first_name ? 'first_name-error' : undefined} class={input} />
              <FieldError id="first_name" errors={errors} />
            </div>
            <div>
              <label for="last_name" class="block font-semibold">Last name</label>
              <input type="text" id="last_name" name="last_name" value={values.last_name ?? ''} autocomplete="family-name"
                aria-invalid={errors.last_name ? 'true' : undefined} aria-describedby={errors.last_name ? 'last_name-error' : undefined} class={input} />
              <FieldError id="last_name" errors={errors} />
            </div>
            <div>
              <label for="address" class="block font-semibold">Street address</label>
              <input type="text" id="address" name="address" value={values.address ?? ''} autocomplete="street-address"
                aria-invalid={errors.address ? 'true' : undefined} aria-describedby={errors.address ? 'address-error' : undefined} class={input} />
              <FieldError id="address" errors={errors} />
            </div>
            <div>
              <label for="city_id" class="block font-semibold">Town</label>
              <select id="city_id" name="city_id"
                aria-invalid={errors.city_id ? 'true' : undefined} aria-describedby={errors.city_id ? 'city_id-error' : undefined} class={input}>
                <option value="">— Pick your town —</option>
                {cities.map((c) => (
                  <option value={String(c.id)} selected={(values.city_id ?? '') === String(c.id)}>{c.name}</option>
                ))}
              </select>
              <FieldError id="city_id" errors={errors} />
            </div>
            <div>
              <label for="phone" class="block font-semibold">Phone number</label>
              <input type="tel" id="phone" name="phone" value={values.phone ?? ''} autocomplete="tel"
                aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={errors.phone ? 'phone-error' : undefined} class={input} />
              <FieldError id="phone" errors={errors} />
            </div>
            <div>
              <label for="email" class="block font-semibold">Email address</label>
              <input type="email" id="email" name="email" value={values.email ?? ''} autocomplete="email"
                aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? 'email-error' : undefined} class={input} />
              <FieldError id="email" errors={errors} />
            </div>
            <div>
              <label for="email_confirm" class="block font-semibold">Type your email again</label>
              <input type="email" id="email_confirm" name="email_confirm" value={values.email_confirm ?? ''}
                aria-invalid={errors.email_confirm ? 'true' : undefined} aria-describedby={errors.email_confirm ? 'email_confirm-error' : undefined} class={input} />
              <FieldError id="email_confirm" errors={errors} />
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <label class="flex items-start gap-3">
              <input type="checkbox" name="diabetic" checked={(values.diabetic ?? '') === 'on'} class="mt-1 h-6 w-6" />
              <span>Someone in my household is diabetic</span>
            </label>
            <fieldset>
              <legend id="permanently_disabled" class="font-semibold">Is anyone in your household permanently disabled?</legend>
              <div class="mt-1 flex gap-6">
                <label class="flex items-center gap-2"><input type="radio" name="permanently_disabled" value="yes" checked={(values.permanently_disabled ?? '') === 'yes'} class="h-6 w-6" /> Yes</label>
                <label class="flex items-center gap-2"><input type="radio" name="permanently_disabled" value="no" checked={(values.permanently_disabled ?? '') === 'no'} class="h-6 w-6" /> No</label>
              </div>
              <FieldError id="permanently_disabled" errors={errors} />
            </fieldset>
            <label class="flex items-start gap-3">
              <input type="checkbox" name="share_with_sponsor" checked={(values.share_with_sponsor ?? '') === 'on'} class="mt-1 h-6 w-6" />
              <span>
                A generous neighbor may sponsor your family. They will never be told your name —
                only what your family needs. <strong>May we share your needs this way?</strong>
              </span>
            </label>
            <label class="flex items-start gap-3">
              <input type="checkbox" id="full_time_residence" name="full_time_residence" checked={(values.full_time_residence ?? '') === 'on'}
                aria-invalid={errors.full_time_residence ? 'true' : undefined} aria-describedby={errors.full_time_residence ? 'full_time_residence-error' : undefined} class="mt-1 h-6 w-6" />
              <span>Everyone I list on this application lives at my address full-time</span>
            </label>
            <FieldError id="full_time_residence" errors={errors} />
            <div>
              <label for="years_received_help" class="block font-semibold">
                How many years have you received help from the Holiday Project?
                <span class="font-normal">(enter 0 if this is your first year)</span>
              </label>
              <input type="text" inputmode="numeric" id="years_received_help" name="years_received_help" value={values.years_received_help ?? ''}
                aria-invalid={errors.years_received_help ? 'true' : undefined} aria-describedby={errors.years_received_help ? 'years_received_help-error' : undefined}
                class="mt-1 w-24 rounded border-2 border-stone-400 bg-white p-3" />
              <FieldError id="years_received_help" errors={errors} />
            </div>
            <fieldset>
              <legend id="adopted_last_year" class="font-semibold">Were you sponsored ("adopted") last year?</legend>
              <div class="mt-1 flex gap-6">
                <label class="flex items-center gap-2"><input type="radio" name="adopted_last_year" value="yes" checked={(values.adopted_last_year ?? '') === 'yes'} class="h-6 w-6" /> Yes</label>
                <label class="flex items-center gap-2"><input type="radio" name="adopted_last_year" value="no" checked={(values.adopted_last_year ?? '') === 'no'} class="h-6 w-6" /> No</label>
              </div>
              <FieldError id="adopted_last_year" errors={errors} />
            </fieldset>
          </div>
        </section>

        <section aria-labelledby="s-bedding">
          <h2 id="s-bedding" class="text-2xl font-bold text-holly-800">Bedding</h2>
          <fieldset class="mt-4">
            <legend id="bed_choice" class="font-semibold">Would you like sheets or a blanket?</legend>
            <div class="mt-2 grid gap-3 sm:grid-cols-3">
              {[
                { value: 'sheets', label: 'Sheets' },
                { value: 'blanket', label: 'A blanket' },
                { value: 'none', label: 'No thank you' },
              ].map((c) => (
                <label class="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-stone-400 bg-white p-4 font-bold has-[:checked]:border-holly-700 has-[:checked]:bg-holly-100">
                  <input type="radio" name="bed_choice" value={c.value} checked={(values.bed_choice ?? '') === c.value} class="h-6 w-6" />
                  {c.label}
                </label>
              ))}
            </div>
            <FieldError id="bed_choice" errors={errors} />
          </fieldset>
          <div class="mt-4">
            <label for="bed_size" class="block font-semibold">Bed size <span class="font-normal">(skip this if you chose "no thank you")</span></label>
            <select id="bed_size" name="bed_size"
              aria-invalid={errors.bed_size ? 'true' : undefined} aria-describedby={errors.bed_size ? 'bed_size-error' : undefined}
              class="mt-1 w-48 rounded border-2 border-stone-400 bg-white p-3">
              <option value="">— Pick a size —</option>
              {['twin', 'full', 'queen', 'king'].map((s) => (
                <option value={s} selected={(values.bed_size ?? '') === s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <FieldError id="bed_size" errors={errors} />
          </div>
        </section>

        <section aria-labelledby="s-work">
          <h2 id="s-work" class="text-2xl font-bold text-holly-800">Work and income</h2>
          <p class="mt-2">Please list every job in your household — we're required to ask. If no one is working right now, just check the box below.</p>
          <div id="employer-list">
            {Array.from({ length: employerCount }, (_, idx) => (
              <EmployerRow index={idx + 1} values={values} errors={errors} />
            ))}
          </div>
          <button type="submit" name="action" value="add_employer" data-add="employer" formnovalidate
            class="mt-3 rounded-lg border-2 border-holly-700 bg-white px-4 py-3 font-bold text-holly-800 hover:bg-holly-100">
            + Add another job
          </button>
          <label class="mt-4 flex items-start gap-3">
            <input type="checkbox" id="no_employment" name="no_employment" checked={(values.no_employment ?? '') === 'on'}
              aria-invalid={errors.no_employment ? 'true' : undefined} aria-describedby={errors.no_employment ? 'no_employment-error' : undefined} class="mt-1 h-6 w-6" />
            <span>No one in our household is currently employed</span>
          </label>
          <FieldError id="no_employment" errors={errors} />
        </section>

        <section aria-labelledby="s-benefits">
          <h2 id="s-benefits" class="text-2xl font-bold text-holly-800">Benefits</h2>
          <p class="mt-2">For each one: enter the amount you receive, or check "we don't receive this." You never have to guess — your award letters have these numbers.</p>
          <BenefitRow benefitKey="food_share" label="Food Share" period="Monthly" hasFor={false} values={values} errors={errors} />
          <BenefitRow benefitKey="social_security" label="Social Security" period="Monthly" hasFor={true} values={values} errors={errors} />
          <BenefitRow benefitKey="ssi" label="SSI" period="Monthly" hasFor={true} values={values} errors={errors} />
          <BenefitRow benefitKey="child_support" label="Child support" period="Monthly" hasFor={true} values={values} errors={errors} />
          <BenefitRow benefitKey="unemployment" label="Unemployment" period="Weekly" hasFor={true} values={values} errors={errors} />
          <BenefitRow benefitKey="other_income" label="Other income" period="Monthly" hasFor={true} values={values} errors={errors} />
        </section>

        <section aria-labelledby="s-household">
          <h2 id="s-household" class="text-2xl font-bold text-holly-800">Your household</h2>
          <p class="mt-2">Tell us about each person living with you, including yourself — you're Person 1. Clothing sizes help us pick things that fit; leave blank anything they don't need.</p>
          <div id="member-list">
            {Array.from({ length: memberCount }, (_, idx) => (
              <MemberCard index={idx + 1} values={values} errors={errors} />
            ))}
          </div>
          <button type="submit" name="action" value="add_member" data-add="member" formnovalidate
            class="mt-3 rounded-lg border-2 border-holly-700 bg-white px-4 py-3 font-bold text-holly-800 hover:bg-holly-100">
            + Add another person
          </button>
        </section>

        <section aria-labelledby="s-deed">
          <h2 id="s-deed" class="text-2xl font-bold text-holly-800">Pay it forward</h2>
          <p class="mt-2">
            The Holiday Project runs on kindness, and everyone has some to give. To receive gifts,
            we ask you to share one act of kindness you've done in your community — things like
            shoveling a neighbor's snow, giving someone a ride, or visiting someone who's lonely.
            (Helping your own family, or work you're paid for, doesn't count for this — the idea
            is to reach someone new.)
          </p>
          <label for="good_deed" class="mt-3 block font-semibold">Tell us about one good deed you've done</label>
          <textarea id="good_deed" name="good_deed" rows="4"
            aria-invalid={errors.good_deed ? 'true' : undefined} aria-describedby={errors.good_deed ? 'good_deed-error' : undefined}
            class={input}>{values.good_deed ?? ''}</textarea>
          <FieldError id="good_deed" errors={errors} />
        </section>

        <button type="submit"
          class="w-full rounded-lg bg-holly-700 px-6 py-4 text-xl font-bold text-white hover:bg-holly-900 sm:w-auto">
          Send my application
        </button>
      </form>
    </>
  )}
</Site>
```

- [ ] **Step 6: Verify both states against local D1**

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &` then `sleep 8`. Then:

Run: `curl -s http://localhost:4321/apply | grep -o "Applications are closed right now"`
Expected: `Applications are closed right now` (seed has `applications_open = 0`).

Run: `npx wrangler d1 execute gchp --local --command "UPDATE settings SET applications_open = 1 WHERE id = 1"` then:

Run: `curl -s http://localhost:4321/apply | grep -c 'id="member_name_1"'` — Expected: `1` (one member card).
Run: `curl -s http://localhost:4321/apply | grep -c 'id="member_name_2"'` — Expected: `0`.
Run: `curl -s http://localhost:4321/apply | grep -o "Pick your town"` — Expected: match.
Run: `curl -s http://localhost:4321/apply | grep -o 'name="csrf_token" value="[0-9a-f]\{64\}"' | head -1` — Expected: a 64-hex token.
Run: `curl -s http://localhost:4321/apply | grep -c "<h1"` — Expected: `1`.

Kill the dev server. Run `npm run test` (all pass) and `npm run build` (Complete!).

- [ ] **Step 7: Commit**

```bash
git add src/components/apply src/pages/apply.astro
git commit -m "feat: apply page - season gate, full form render, components"
```

---

### Task 10: Apply POST handler + thank-you page

**Files:**
- Modify: `src/pages/apply.astro` (frontmatter only — replace the `// Task 10 fills in POST handling here.` block)
- Create: `src/pages/apply/thank-you.astro`

**Interfaces:**
- Consumes: `validateApplication`, `MAX_MEMBERS`, `MAX_EMPLOYERS` (Task 6); `mayNotBeEligible`, `suggestHouseholdType` (Task 7); `insertApplication` (Task 8); `renderApplicationReceivedEmail` (Task 4); `sendEmail` (Task 3); `verifyCsrf` (csrf.ts); `allowRequest`, `D1RateStore` (rate-limit.ts).
- Produces: the complete POST behavior. Order (binding-note compliant): add-row actions (no validation) → honeypot (only fake-success path) → CSRF failure (friendly retry, values preserved) → validation errors (re-render) → rate limit consumed ONLY by valid submissions (over-limit re-renders with values + kind note — never a silent drop) → insert + received email (failure tolerated) → `303` redirect to `/apply/thank-you`. No PII in the redirect URL.

- [ ] **Step 1: Write the thank-you page**

`src/pages/apply/thank-you.astro`:

```astro
---
import '../../styles/global.css';
import Site from '../../layouts/Site.astro';
export const prerender = true;
---
<Site title="We received your application">
  <h1 class="text-3xl font-bold text-holly-800">We received your application. Thank you!</h1>
  <div class="mt-6 rounded border-l-4 border-holly-700 bg-white p-5 space-y-3">
    <p class="text-xl font-bold text-holly-800">Here's what happens next:</p>
    <ol class="list-decimal space-y-2 pl-6">
      <li>Our volunteers will review your application.</li>
      <li>You'll get an email from us when it has been reviewed.</li>
      <li>If approved, you'll receive a pickup slip with your pickup date in December.</li>
    </ol>
    <p>You don't need to do anything else right now. If you gave us an email address, a
       confirmation is on its way to your inbox.</p>
  </div>
  <p class="mt-6">
    Your information is private. We use it only to prepare your family's gifts, and we never
    share your name with donors or sponsors without your permission.
  </p>
  <p class="mt-4">
    Questions? Call our message line at <strong>608-723-2136 ext 1194</strong> and leave your
    name and phone number. You can also check
    <a href="/pickup" class="font-semibold text-berry-700 underline">this year's pickup schedule</a>.
  </p>
</Site>
```

- [ ] **Step 2: Wire the POST handler**

In `src/pages/apply.astro`, add to the imports:

```ts
import { validateApplication } from '../lib/validation/application';
import { mayNotBeEligible, suggestHouseholdType } from '../lib/eligibility';
import { insertApplication } from '../lib/db';
import { renderApplicationReceivedEmail } from '../lib/email/render';
import { sendEmail } from '../lib/email/send';
import { verifyCsrf } from '../lib/csrf';
import { allowRequest, D1RateStore } from '../lib/rate-limit';
```

Replace the line `// Task 10 fills in POST handling here.` with:

```ts
if (Astro.request.method === 'POST' && open) {
  const form = await Astro.request.formData();
  values = Object.fromEntries(
    [...form.entries()].filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
  const action = values.action ?? '';

  if (action === 'add_member' || action === 'add_employer') {
    // Just grow the form — no validation, nothing lost, nothing saved.
    const key = action === 'add_member' ? 'member_count' : 'employer_count';
    const max = action === 'add_member' ? MAX_MEMBERS : MAX_EMPLOYERS;
    values[key] = String(Math.min((Number(values[key]) || 1) + 1, max));
  } else if ((values.website ?? '').trim() !== '') {
    // Honeypot: the ONLY fake-success path (binding note: humans never get one).
    return Astro.redirect('/apply/thank-you', 303);
  } else {
    const okCsrf = await verifyCsrf(
      env.CSRF_SECRET,
      Astro.cookies.get('csrf')?.value ?? '',
      values.csrf_token ?? '',
    );
    const result = validateApplication(values);

    if (!okCsrf) {
      // Never discard an application over a stale token (binding note).
      retryNote =
        'Sorry — this page had been open a while, so we gave it a quick safety refresh. Everything you typed is still here. Please press "Send my application" once more.';
    } else if (result.ok && result.spam) {
      return Astro.redirect('/apply/thank-you', 303);
    } else if (result.ok) {
      // Only valid submissions consume the rate budget.
      const ip = Astro.request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const okRate = await allowRequest(
        new D1RateStore(env.DB),
        `apply:${ip}`,
        5,
        60 * 60_000,
        Date.now(),
      );
      if (!okRate) {
        // Never silently drop a valid application (binding note): keep their
        // typing on screen and tell them plainly what to do.
        rateNote =
          "We've received quite a few applications from this connection just now, so we've paused it briefly. Nothing you typed is lost — please wait a little while and press \"Send my application\" again, or call us at 608-723-2136 ext 1194.";
      } else {
        const submittedAt = new Date().toISOString();
        const appRecord = {
          ...result.clean,
          seasonYear: new Date().getFullYear(),
          submittedAt,
          mayNotBeEligible: mayNotBeEligible(result.clean),
          householdType: suggestHouseholdType(result.clean),
        };
        await insertApplication(env.DB, appRecord);
        // Email failure never blocks a saved application (spec §3).
        await sendEmail(
          env,
          result.clean.email,
          renderApplicationReceivedEmail(result.clean.firstName),
        );
        return Astro.redirect('/apply/thank-you', 303);
      }
    } else {
      errors = result.errors;
    }
  }
}
```

- [ ] **Step 3: Verify the full life cycle against the dev server**

Setup: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8`, ensure open: `npx wrangler d1 execute gchp --local --command "UPDATE settings SET applications_open = 1 WHERE id = 1"`, clear limits: `npx wrangler d1 execute gchp --local --command "DELETE FROM rate_limits"`.

> **Amendment (execution finding):** when cleaning up application test rows afterwards, delete
> children FIRST — `household_members`, `employers`, then `applications` — the FK constraints
> reject a parent-first delete order.

Helper used below (fresh jar + token from ONE response):

```bash
JAR=$(mktemp)
tok() { curl -s -c "$JAR" http://localhost:4321/apply | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}'; }
```

(a) **Add-row preserves values and shows no errors:**

```bash
T=$(tok)
curl -s -b "$JAR" --data-urlencode "csrf_token=$T" --data-urlencode "action=add_member" \
  --data-urlencode "member_count=1" --data-urlencode "first_name=Sue" http://localhost:4321/apply > /tmp/addrow.html
grep -c 'name="member_name_2"' /tmp/addrow.html   # Expected: 1 (second card appeared)
grep -c 'value="Sue"' /tmp/addrow.html            # Expected: >= 1 (typing preserved)
grep -c 'role="alert"' /tmp/addrow.html           # Expected: 0 (no error summary)
```

(b) **Invalid submit re-renders with error summary and preserved values:**

```bash
T=$(tok)
curl -s -b "$JAR" --data-urlencode "csrf_token=$T" --data-urlencode "first_name=Sue" \
  --data-urlencode "member_count=1" --data-urlencode "employer_count=1" http://localhost:4321/apply > /tmp/invalid.html
grep -c 'role="alert"' /tmp/invalid.html          # Expected: 1
grep -o 'Please tell us your last name' /tmp/invalid.html | head -1   # Expected: match
grep -c 'value="Sue"' /tmp/invalid.html           # Expected: >= 1
```

(c) **Stale token gets the friendly retry, not fake success:**

```bash
T=$(tok)
curl -s -b "$JAR" --data-urlencode "csrf_token=$(printf '0%.0s' {1..64})" --data-urlencode "first_name=Sue" \
  http://localhost:4321/apply | grep -o 'Everything you typed is still here'
# Expected: match — and no redirect. (Grep a quote-free fragment: Astro escapes
# double quotes in rendered text, so grepping the quoted phrase would miss.)
```

(d) **Valid submit: 303, row in D1, members + employers written:** build a full valid POST (all fields from the Task 6 `fullValid` fixture, city_id=13):

```bash
T=$(tok)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b "$JAR" \
  --data-urlencode "csrf_token=$T" \
  --data-urlencode "first_name=Sue" --data-urlencode "last_name=Smith" \
  --data-urlencode "address=1 Elm St" --data-urlencode "city_id=13" \
  --data-urlencode "phone=608-555-0100" \
  --data-urlencode "email=sue@example.com" --data-urlencode "email_confirm=sue@example.com" \
  --data-urlencode "permanently_disabled=no" --data-urlencode "full_time_residence=on" \
  --data-urlencode "years_received_help=0" --data-urlencode "adopted_last_year=no" \
  --data-urlencode "bed_choice=blanket" --data-urlencode "bed_size=queen" \
  --data-urlencode "employer_count=1" --data-urlencode "employer_name_1=Acme" \
  --data-urlencode "worker_name_1=Sue Smith" --data-urlencode "hourly_wage_1=15.50" \
  --data-urlencode "hours_per_week_1=32" \
  --data-urlencode "food_share_none=on" --data-urlencode "social_security_none=on" \
  --data-urlencode "ssi_none=on" --data-urlencode "child_support_none=on" \
  --data-urlencode "unemployment_none=on" --data-urlencode "other_income_none=on" \
  --data-urlencode "member_count=2" \
  --data-urlencode "member_name_1=Sue Smith" --data-urlencode "member_relationship_1=self" \
  --data-urlencode "member_sex_1=F" --data-urlencode "member_age_1=34" \
  --data-urlencode "member_name_2=Tim Smith" --data-urlencode "member_relationship_2=son" \
  --data-urlencode "member_sex_2=M" --data-urlencode "member_age_2=7" \
  --data-urlencode "good_deed=I shoveled my neighbor's snow." \
  http://localhost:4321/apply
# Expected: 303 http://localhost:4321/apply/thank-you
```

Then:

```bash
npx wrangler d1 execute gchp --local --command "SELECT first_name, status, season_year, household_type, may_not_be_eligible FROM applications ORDER BY id DESC LIMIT 1"
# Expected: Sue | new | <current year> | family | 0
npx wrangler d1 execute gchp --local --command "SELECT COUNT(*) AS members FROM household_members WHERE application_id = (SELECT MAX(id) FROM applications)"
# Expected: 2
curl -s http://localhost:4321/apply/thank-you | grep -o "what happens next" -i | head -1
# Expected: match
```

(e) **Closed gate rejects POST:** `npx wrangler d1 execute gchp --local --command "UPDATE settings SET applications_open = 0 WHERE id = 1"`, then repeat (d)'s POST — Expected: `200` with the closed-message page, and no new row in `applications`. Re-open afterwards (`applications_open = 1`).

Kill the dev server. Run `npm run test` and `npm run build` — both green.

- [ ] **Step 4: Commit**

```bash
git add src/pages/apply.astro src/pages/apply/thank-you.astro
git commit -m "feat: apply POST handling, eligibility flagging, thank-you page"
```

---

### Task 11: Progressive enhancement — instant add-row

**Files:**
- Create: `public/scripts/apply.js`
- Modify: `src/pages/apply.astro` (add two `<template>` blocks + one `<script>` tag inside the open-state branch)

**Interfaces:**
- Consumes: the `data-add` buttons, `#member-list`/`#employer-list` containers, `member_count`/`employer_count` hidden inputs, and the `MemberCard`/`EmployerRow` components rendered with `index="__N__"`.
- Produces: with JS, "+ Add another person/job" adds the row instantly (no reload) and focuses its first field; without JS, the buttons keep working as submits. No behavior change for validation or POST.

- [ ] **Step 1: Add the templates and script tag to `src/pages/apply.astro`**

Inside the open-state branch, directly BEFORE the closing `</form>` tag, add:

```astro
        <template id="member-template">
          <MemberCard index="__N__" values={{}} errors={{}} />
        </template>
        <template id="employer-template">
          <EmployerRow index="__N__" values={{}} errors={{}} />
        </template>
```

Directly AFTER the closing `</form>` tag, add:

```astro
      <script src="/scripts/apply.js" defer></script>
```

- [ ] **Step 2: Write the script**

`public/scripts/apply.js`:

```js
// Progressive enhancement only: without JavaScript, the "+ Add another"
// buttons submit the form and the server re-renders with an extra row.
// With JavaScript, we add the row instantly instead. Limits mirror the
// server's MAX_MEMBERS (15) and MAX_EMPLOYERS (10) clamps.
(function () {
  var MAX = { member: 15, employer: 10 };

  document.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var kind = btn.getAttribute('data-add');
      var tpl = document.getElementById(kind + '-template');
      var list = document.getElementById(kind + '-list');
      var countInput = document.querySelector('input[name="' + kind + '_count"]');
      if (!tpl || !list || !countInput) return; // fall back to server round trip

      var next = Number(countInput.value) + 1;
      if (!(next >= 2) || next > MAX[kind]) return; // at the cap: let the server answer

      e.preventDefault();
      countInput.value = String(next);
      list.insertAdjacentHTML('beforeend', tpl.innerHTML.replace(/__N__/g, String(next)));
      var first = list.lastElementChild.querySelector('input, select, textarea');
      if (first) first.focus();
    });
  });
})();
```

- [ ] **Step 3: Verify**

Run: `npm run build` — Expected: Complete! (templates compile; `__N__` renders as a literal index).

Run: `npm run dev > /tmp/astro-dev.log 2>&1 &`, `sleep 8` (with `applications_open = 1`):

```bash
curl -s http://localhost:4321/apply | grep -c '<template id="member-template">'   # Expected: 1
curl -s http://localhost:4321/apply | grep -c 'member_name___N__'                 # Expected: >= 1 (placeholder inside template)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/scripts/apply.js     # Expected: 200
```

No-JS regression check — repeat Task 10 verification (a) (server-side add-row): must still pass unchanged. Kill the server; `npm run test` green.

Manual note for the controller's review pass: open http://localhost:4321/apply in a real browser once, click "+ Add another person", confirm the card appears instantly and focus lands in its name field.

- [ ] **Step 4: Commit**

```bash
git add public/scripts/apply.js src/pages/apply.astro
git commit -m "feat: instant add-row progressive enhancement"
```

---

### Task 12: Exit verification + README dev notes

**Files:**
- Modify: `README.md` (Local development section)

**Interfaces:**
- Consumes: everything above. Produces: documented dev workflow; verified exit criteria.

- [ ] **Step 1: Add to README's Local development section (after the existing numbered list)**

```markdown
### Working on the application form

Applications are gated by a switch in the database (closed by default). To open them locally:

    npx wrangler d1 execute gchp --local --command "UPDATE settings SET applications_open = 1 WHERE id = 1"

Submitted test applications land in the `applications` table:

    npx wrangler d1 execute gchp --local --command "SELECT id, first_name, status FROM applications"
```

- [ ] **Step 2: Full verification**

Run: `npm run test` — Expected: all tests pass (Plan 1's 21 + everything added here), pristine output.
Run: `npm run build` — Expected: Complete!.
Run: `npx tsc --noEmit` — Expected: clean.

Spot-check the exit criteria below; anything failing goes back to its task.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: local dev notes for the application form"
```

---

## Plan 2 exit criteria

- Suite, build, and typecheck green.
- `/apply` closed state shows the warm message + both fallbacks; open state renders the full six-section form; the switch is a single settings column.
- Server-side round trips verified: add-row preserves values with no errors; invalid submit re-renders with a linked error summary and every value preserved; stale CSRF gets a friendly retry (never fake success); over-limit valid submissions are never silently dropped; honeypot is the only fake-success path; valid submit 303s to `/apply/thank-you`, writes application + members + employers, flags eligibility, and sends the received email (whose failure never blocks).
- Eligibility flag and household type match the spec formulas exactly (unit-tested).
- FK enforcement, rate-limiter boundary, and D1RateStore behavior are integration-tested against real local D1 (Plan 1 binding notes closed).
- Works with JavaScript disabled end-to-end; the enhancement script only makes add-row instant.
- One `<h1>` per page; labels on every control; `aria-invalid`/`aria-describedby` wiring; error summary is `role="alert"` with anchor links; usable at 360px.
- Not in this plan: admin console (Plan 3), migration/cutover (Plan 4).
