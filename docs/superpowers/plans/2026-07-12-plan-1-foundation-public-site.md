# Plan 1: Foundation + Public Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Astro site on Cloudflare Pages with the full D1 schema, the holiday theme, and all public pages (Home, Donate, Apply-closed stub, Pickup Schedule, Pay It Forward, Contact with working form, paper-application PDF route).

**Architecture:** Astro 5 in `output: 'server'` mode with the Cloudflare adapter; static pages opt in with `export const prerender = true`. Server-rendered pages read D1 through `Astro.locals.runtime.env`. Pure logic (validation, CSRF, rate limiting, email rendering) lives in `src/lib/` as dependency-free TypeScript modules built test-first with Vitest. This is Plan 1 of 4 (2: applicant flow, 3: admin console, 4: migration/cutover).

**Tech Stack:** Astro ^5, @astrojs/cloudflare ^12, Tailwind CSS ^4 (via @tailwindcss/vite), Cloudflare D1 + R2, Resend (via plain `fetch` — no SDK), Vitest ^3, wrangler ^4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-gchp-site-design.md`. It governs on any conflict.
- Runtime/build dependencies: **only** `astro`, `@astrojs/cloudflare`, `tailwindcss`, `@tailwindcss/vite`. Dev-only: `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`. Adding anything else requires owner approval.
- Resend is called with plain `fetch` — do not add the `resend` package.
- No third-party tracking/analytics. No external requests from pages except the PayPal form action on Donate.
- Mailing address everywhere: **235 W. Elm St., Lancaster WI 53813**. Phone: **608-723-2136 ext 1194** (message line). Contact email: `skleinow@co.grant.wi.gov`.
- Public pages: mobile-first, correct at 360px width, WCAG 2.2 AA contrast, working with JavaScript disabled, base text ≥ 18px, plain warm language.
- Never log applicant/visitor PII. All D1 access via prepared statements with `.bind()`.
- Secrets only in `.dev.vars` (gitignored) locally and Cloudflare Pages env vars in production — never in the repo.
- TDD for every logic module (Tasks 4–7): failing test first, then minimal implementation.
- Node ≥ 22 (wrangler 4.x requires it; amended from ≥ 20 during Task 1 review). All commands run from the repo root (`holiday-project/`). The Astro project lives at the repo root beside `legacy/` and `docs/`.
- Commit after every task (message style: `feat: …`, `chore: …`, `test: …`). End every commit message with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `wrangler.toml`, `.gitignore`, `.dev.vars.example`, `src/env.d.ts`, `src/styles/global.css` (placeholder), `src/pages/index.astro` (placeholder), `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Astro.locals.runtime.env` typed as `Env` (`DB: D1Database`, `FILES: R2Bucket`, `RESEND_API_KEY`, `CSRF_SECRET`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `CONTACT_TO` — all strings). Commands `npm run dev|build|test`. The wrangler bindings `DB` (D1 `gchp`) and `FILES` (R2 `gchp-files`).

- [ ] **Step 1: Write the config files**

`package.json`:

```json
{
  "name": "gchp-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "test": "vitest run",
    "db:migrate:local": "wrangler d1 migrations apply gchp --local",
    "db:migrate:remote": "wrangler d1 migrations apply gchp --remote"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.5.0",
    "astro": "^5.7.0",
    "@tailwindcss/vite": "^4.1.0",
    "tailwindcss": "^4.1.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260101.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  vite: { plugins: [tailwindcss()] },
});
```

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["dist", "legacy"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`wrangler.toml` (the `database_id` line is filled in during Task 13 when the remote database is created; the local proxy does not need it):

```toml
name = "gchp-site"
compatibility_date = "2026-06-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "gchp"
database_id = "set-in-task-13-after-wrangler-d1-create"

[[r2_buckets]]
binding = "FILES"
bucket_name = "gchp-files"

[vars]
EMAIL_FROM = "Grant County Holiday Project <no-reply@grantcountyholidayproject.com>"
EMAIL_REPLY_TO = "skleinow@co.grant.wi.gov"
CONTACT_TO = "skleinow@co.grant.wi.gov"
```

`.gitignore`:

```
node_modules/
dist/
.astro/
.wrangler/
.dev.vars
```

`.dev.vars.example` (copy to `.dev.vars` locally and fill in):

```
RESEND_API_KEY=re_your_key_here
CSRF_SECRET=any-long-random-string-for-local-dev
```

`src/env.d.ts`:

```ts
/// <reference types="astro/client" />

type Env = {
  DB: D1Database;
  FILES: R2Bucket;
  RESEND_API_KEY: string;
  CSRF_SECRET: string;
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
  CONTACT_TO: string;
};

declare namespace App {
  interface Locals {
    runtime: { env: Env };
  }
}
```

`src/styles/global.css` (placeholder; Task 3 fills in the theme):

```css
@import "tailwindcss";
```

`src/pages/index.astro` (placeholder; replaced in Task 9):

```astro
---
export const prerender = true;
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Grant County Holiday Project</title></head>
  <body><h1>Grant County Holiday Project — coming soon</h1></body>
</html>
```

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Install and verify**

Run: `npm install`
Expected: completes without errors (warnings are fine).

Run: `npm run test`
Expected: `1 passed` (smoke test).

Run: `npm run build`
Expected: `Complete!` with output in `dist/`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts wrangler.toml .gitignore .dev.vars.example src tests
git commit -m "chore: scaffold Astro + Cloudflare + Tailwind + Vitest project"
```

---

### Task 2: D1 schema and seed data

**Files:**
- Create: `migrations/0001_init.sql`, `migrations/0002_seed.sql`

**Interfaces:**
- Consumes: wrangler config from Task 1.
- Produces: every table in spec §2 (exact names/columns below) plus `rate_limits`. Seeded: 23 `cities` (legacy IDs preserved — IDs run 1–24 with a gap at 21), the single `settings` row (id=1, `applications_open`=0), 2 `admin_emails`, 3 `content_blocks`, 8 `pickup_days`.

- [ ] **Step 1: Write the schema migration**

`migrations/0001_init.sql`:

```sql
CREATE TABLE cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  zip TEXT NOT NULL
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  applications_open INTEGER NOT NULL DEFAULT 0,
  pickup_title TEXT NOT NULL DEFAULT '',
  pickup_intro TEXT NOT NULL DEFAULT '',
  pickup_footer TEXT NOT NULL DEFAULT '',
  pdf_uploaded_at TEXT
);

CREATE TABLE content_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE pickup_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  date_text TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  deleted_at TEXT
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','denied')),
  submitted_at TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  diabetic INTEGER NOT NULL DEFAULT 0,
  share_with_sponsor INTEGER NOT NULL DEFAULT 0,
  permanently_disabled INTEGER NOT NULL DEFAULT 0,
  bed_choice TEXT NOT NULL DEFAULT 'none' CHECK (bed_choice IN ('sheets','blanket','none')),
  bed_size TEXT CHECK (bed_size IN ('twin','full','queen','king')),
  full_time_residence_confirmed INTEGER NOT NULL DEFAULT 0,
  years_received_help INTEGER NOT NULL DEFAULT 0,
  adopted_last_year INTEGER NOT NULL DEFAULT 0,
  household_type TEXT NOT NULL DEFAULT 'family' CHECK (household_type IN ('family','elderly','disabled')),
  no_employment_confirmed INTEGER NOT NULL DEFAULT 0,
  food_share_amount REAL,
  social_security_amount REAL,
  social_security_for TEXT,
  ssi_amount REAL,
  ssi_for TEXT,
  child_support_amount REAL,
  child_support_for TEXT,
  unemployment_weekly_amount REAL,
  unemployment_for TEXT,
  other_income_amount REAL,
  other_income_for TEXT,
  good_deed TEXT NOT NULL DEFAULT '',
  may_not_be_eligible INTEGER NOT NULL DEFAULT 0,
  pu_number INTEGER,
  bags_count INTEGER,
  deleted_at TEXT
);
CREATE INDEX idx_applications_season ON applications(season_year, status);

CREATE TABLE household_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL,
  pants TEXT NOT NULL DEFAULT '',
  shirt_top TEXT NOT NULL DEFAULT '',
  underwear TEXT NOT NULL DEFAULT '',
  socks TEXT NOT NULL DEFAULT '',
  diapers TEXT NOT NULL DEFAULT '',
  gifts TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_members_app ON household_members(application_id);

CREATE TABLE employers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  employer_name TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  hourly_wage REAL NOT NULL,
  hours_per_week REAL NOT NULL
);
CREATE INDEX idx_employers_app ON employers(application_id);

CREATE TABLE donors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  deleted_at TEXT
);

CREATE TABLE donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES donors(id),
  date TEXT NOT NULL,
  item_description TEXT NOT NULL DEFAULT '',
  amount REAL,
  deleted_at TEXT
);

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE admin_emails (
  email TEXT PRIMARY KEY
);

CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
```

- [ ] **Step 2: Write the seed migration**

`migrations/0002_seed.sql` (cities keep their legacy IDs — note there is deliberately no ID 21; content text comes from the live 2025 site with the address corrected to 235 per the owner):

```sql
INSERT INTO cities (id, name, zip) VALUES
  (1,'Bagley','53801'),(2,'Beetown','53802'),(3,'Bloomington','53804'),
  (4,'Blue River','53518'),(5,'Boscobel','53805'),(6,'Cassville','53806'),
  (7,'Cuba City','53807'),(8,'Dickeyville','53808'),(9,'Fennimore','53809'),
  (10,'Glen Haven','53810'),(11,'Hazel Green','53811'),(12,'Kieler','53812'),
  (13,'Lancaster','53813'),(14,'Livingston','53554'),(15,'Montfort','53569'),
  (16,'Mount Hope','53816'),(17,'Muscoda','53573'),(18,'Patch Grove','53817'),
  (19,'Platteville','53818'),(20,'Potosi','53820'),(22,'Stitzer','53824'),
  (23,'Woodman','53827'),(24,'Prairie du Chien','53821');

INSERT INTO settings (id, applications_open, pickup_title, pickup_intro, pickup_footer) VALUES
  (1, 0,
   '2025 Pickup Schedule — one-day pickups. Pickup time 11 AM–2:30 PM, except Boscobel and Platteville 11 AM–3:30 PM.',
   'You can only pick up your items if you have received a pickup slip by mail or email. Please bring your pickup slip. Your items will be available on your pickup date — not before. If you can''t make it on your date, you can pick up on the next scheduled date below, or send someone else with your slip.',
   'Items not picked up by the last date will be placed back in inventory and become unavailable.');

INSERT INTO admin_emails (email) VALUES
  ('skleinow@co.grant.wi.gov'),
  ('codydps@gmail.com');

INSERT INTO content_blocks (title, subtitle, body, sort_order) VALUES
  ('2025 Info', 'Pickup times',
   'Our site and mailing address is 235 W. Elm St., Lancaster WI 53813. Again this year there will be one-day pickup for all towns, except Boscobel and Platteville which have two days. Dates are listed on pickup slips. You must have your pickup slip to receive items. Pay It Forward is still required for program eligibility — you will receive a form to list your good deeds. Kindness is needed year-round.',
   1),
  ('Special Gifts List', 'No guarantee you will receive',
   'Silverware, hair dryer, drawing kit, smart watch, wireless speaker, turbo scrubber, 12-cup coffee maker, 30-pc marker set, frying pan set, baking pan set, 4-slice toaster, electric griddle, 2 red sofa pillows, bed pillows, fishing pole in carrier, crockpot, cookware set, screwdriver set, hand mixer, air fryer.',
   2),
  ('Applications', 'Applications open October 1 of each project year',
   'You can apply online, or call 608-723-2136 ext 1194 to request a paper application. Speak slowly and leave your name, address, and whether you are a family or elderly household. This is a message-only line. Please return your application as soon as possible.',
   3);

INSERT INTO pickup_days (sort_order, date_text, description) VALUES
  (1, 'Tuesday Dec 2nd',   'Pickup for: Lancaster, Beetown, Prairie du Chien, Glen Haven, Mt. Hope, Patch Grove, Bloomington, Potosi, and Cassville. Pickup time 11 AM–2:30 PM.'),
  (2, 'Wednesday Dec 3rd', 'Pickup for: Woodman, Stitzer, Montfort, Blue River, Fennimore, Livingston, Muscoda, and Bagley. Pickup time 11 AM–2:30 PM.'),
  (3, 'Monday Dec 8th',    'Pickup for: Platteville, Hazel Green, Cuba City, Dickeyville, and Kieler. Pickup time 11 AM–3:30 PM.'),
  (4, 'Tuesday Dec 9th',   'Pickup for: Platteville, Hazel Green, Cuba City, Dickeyville, and Kieler. Pickup time 11 AM–3:30 PM.'),
  (5, 'Wednesday Dec 10th','Pickup for: Boscobel. Pickup time 11 AM–3:30 PM.'),
  (6, 'Thursday Dec 11th', 'Pickup for: Boscobel. Pickup time 11 AM–3:30 PM.'),
  (7, 'Monday Dec 15th',   'Stragglers: anyone who has not picked up yet or applied late. Pickup time 11 AM–2:30 PM.'),
  (8, 'Tuesday Dec 16th',  'Stragglers: anyone who has not picked up yet or applied late. Pickup time 11 AM–2:30 PM.');
```

- [ ] **Step 3: Apply locally and verify**

Run: `npm run db:migrate:local`
Expected: both migrations apply, `2 migrations applied`.

Run: `npx wrangler d1 execute gchp --local --command "SELECT COUNT(*) AS n FROM cities"`
Expected: `n = 23` (legacy city IDs run 1–24 with a deliberate gap at 21).

Run: `npx wrangler d1 execute gchp --local --command "SELECT applications_open FROM settings WHERE id = 1"`
Expected: `applications_open = 0`.

- [ ] **Step 4: Commit**

```bash
git add migrations
git commit -m "feat: D1 schema and seed data (cities, settings, admin emails, content)"
```

---

### Task 3: Theme and site layout

> **Review amendments (do not re-run this task from the code below without them):**
> the focus indicator is a two-tone ring (`outline: 3px solid holly-900; outline-offset: 2px;
> box-shadow: 0 0 0 2px #fff`) so it meets 3:1 on both dark and light surfaces; the footer
> container uses `text-lg` (18px), not `text-base`; the masthead site title is an
> `<a href="/">` home link (non-heading — every page supplies its own single `<h1>`); the
> palette comment in `global.css` names the verified safe color pairings instead of a blanket
> claim. See `src/styles/global.css` and `src/layouts/Site.astro` for the authoritative code.

**Files:**
- Create: `src/layouts/Site.astro`, `public/images/toys-for-tots.gif`, `public/robots.txt`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `global.css` from Task 1.
- Produces: `<Site title="..." description?="...">` layout component wrapping every public page (header, nav, footer, skip link). Theme color tokens usable as Tailwind classes: `cream`, `holly-100`, `holly-700`, `holly-800`, `holly-900`, `berry-700`, `berry-800`, `gold-500`. All body text ≥ 18px.

- [ ] **Step 1: Write the theme**

Replace `src/styles/global.css` with:

```css
@import "tailwindcss";

@theme {
  /* Light, bright, holiday accents. Text colors below all meet WCAG AA (4.5:1) on white/cream. */
  --color-cream: #fffdf7;
  --color-holly-100: #dcf2e4;
  --color-holly-700: #1a6b3a;
  --color-holly-800: #14532d;
  --color-holly-900: #0d3b20;
  --color-berry-700: #b91c1c;
  --color-berry-800: #991b1b;
  --color-gold-500: #d1a054; /* decorative accents only — never body text */
}

:focus-visible {
  outline: 3px solid var(--color-berry-700);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Write the layout**

`src/layouts/Site.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
}
const {
  title,
  description = 'The Grant County Holiday Project provides food, gifts, and clothing to Grant County families and elderly during the holiday season.',
} = Astro.props;

const nav = [
  { href: '/', label: 'Home' },
  { href: '/donate', label: 'Donate' },
  { href: '/apply', label: 'Apply' },
  { href: '/pickup', label: 'Pickup Schedule' },
  { href: '/contact', label: 'Contact' },
];
const current = Astro.url.pathname.replace(/\/$/, '') || '/';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} — Grant County Holiday Project</title>
    <meta name="description" content={description} />
  </head>
  <body class="min-h-screen bg-cream text-stone-900 text-lg leading-relaxed">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-holly-900"
      >Skip to main content</a
    >
    <header>
      <div class="border-b-8 border-berry-700 bg-holly-800 px-4 py-6 text-white">
        <div class="mx-auto max-w-4xl">
          <p class="text-3xl font-bold">Grant County Holiday Project</p>
          <p class="mt-1 text-holly-100">Helping Hands Through United Hands</p>
        </div>
      </div>
      <nav aria-label="Main menu" class="bg-holly-700">
        <ul class="mx-auto flex max-w-4xl flex-wrap px-2">
          {
            nav.map((item) => (
              <li>
                <a
                  href={item.href}
                  aria-current={current === item.href ? 'page' : undefined}
                  class="block px-4 py-3 font-semibold text-white hover:bg-holly-900 aria-[current=page]:bg-holly-900 aria-[current=page]:underline"
                >
                  {item.label}
                </a>
              </li>
            ))
          }
        </ul>
      </nav>
    </header>
    <main id="main" class="mx-auto max-w-4xl px-4 py-8">
      <slot />
    </main>
    <footer class="mt-12 border-t-4 border-gold-500 bg-white">
      <div class="mx-auto max-w-4xl space-y-1 px-4 py-6 text-base text-stone-700">
        <p class="font-semibold text-stone-900">Grant County Holiday Project</p>
        <p>235 W. Elm St., Lancaster WI 53813 · Message line: 608-723-2136 ext 1194</p>
        <p>
          <a class="underline" href="https://grantcounty.org/">Grant County Website</a> ·
          <a class="underline" href="/admin">Admin</a>
        </p>
      </div>
    </footer>
  </body>
</html>
```

Note: `global.css` is imported per-page (each page adds `import '../styles/global.css';` in its frontmatter) — Task 8 onward shows this in every page.

- [ ] **Step 3: Copy assets**

```bash
mkdir -p public/images
cp legacy/public_html/imgs/tft.gif public/images/toys-for-tots.gif
cp legacy/public_html/favicon.ico public/favicon.ico
```

`public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /admin
```

- [ ] **Step 4: Verify build and commit**

Run: `npm run build`
Expected: `Complete!` with no errors.

```bash
git add src/styles/global.css src/layouts/Site.astro public
git commit -m "feat: holiday theme tokens and shared site layout"
```

---

### Task 4: CSRF module (TDD)

**Files:**
- Create: `src/lib/csrf.ts`
- Test: `tests/csrf.test.ts`

**Interfaces:**
- Consumes: nothing (Web Crypto only — available in Workers and Node ≥ 20).
- Produces:
  - `newCsrfCookieValue(): string` — 64-char random hex.
  - `csrfTokenFor(secret: string, cookieValue: string): Promise<string>` — HMAC-SHA256 hex.
  - `verifyCsrf(secret: string, cookieValue: string, token: string): Promise<boolean>`.
  Pattern: server sets a random `csrf` cookie and renders the matching HMAC token in a hidden field; POST handlers verify the pair.

- [ ] **Step 1: Write the failing tests**

`tests/csrf.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../src/lib/csrf';

const SECRET = 'test-secret';

describe('csrf', () => {
  it('generates 64-char hex cookie values, unique per call', () => {
    const a = newCsrfCookieValue();
    const b = newCsrfCookieValue();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('verifies a token made for the same cookie and secret', async () => {
    const cookie = newCsrfCookieValue();
    const token = await csrfTokenFor(SECRET, cookie);
    expect(await verifyCsrf(SECRET, cookie, token)).toBe(true);
  });

  it('rejects a token made for a different cookie', async () => {
    const token = await csrfTokenFor(SECRET, newCsrfCookieValue());
    expect(await verifyCsrf(SECRET, newCsrfCookieValue(), token)).toBe(false);
  });

  it('rejects a token made with a different secret', async () => {
    const cookie = newCsrfCookieValue();
    const token = await csrfTokenFor('other-secret', cookie);
    expect(await verifyCsrf(SECRET, cookie, token)).toBe(false);
  });

  it('rejects empty cookie or token', async () => {
    const cookie = newCsrfCookieValue();
    const token = await csrfTokenFor(SECRET, cookie);
    expect(await verifyCsrf(SECRET, '', token)).toBe(false);
    expect(await verifyCsrf(SECRET, cookie, '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/csrf'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

`src/lib/csrf.ts`:

```ts
// Double-submit CSRF: a random cookie value plus an HMAC of it rendered as a
// hidden form field. Verification recomputes the HMAC and compares in
// constant time. Stateless — nothing stored server-side.

const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return toHex(new Uint8Array(sig));
}

export function newCsrfCookieValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function csrfTokenFor(secret: string, cookieValue: string): Promise<string> {
  return hmacHex(secret, cookieValue);
}

export async function verifyCsrf(
  secret: string,
  cookieValue: string,
  token: string,
): Promise<boolean> {
  if (!cookieValue || !token) return false;
  const expected = await hmacHex(secret, cookieValue);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: all csrf tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csrf.ts tests/csrf.test.ts
git commit -m "feat: stateless double-submit CSRF module"
```

---

### Task 5: Rate limiter (TDD)

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Consumes: `rate_limits` table (Task 2).
- Produces:
  - `interface RateStore { get(key: string): Promise<{ windowStart: number; count: number } | null>; set(key: string, v: { windowStart: number; count: number }): Promise<void>; }`
  - `allowRequest(store: RateStore, key: string, limit: number, windowMs: number, now: number): Promise<boolean>` — fixed-window counter.
  - `class MemoryRateStore implements RateStore` (tests), `class D1RateStore implements RateStore` (constructor takes `D1Database`).

- [ ] **Step 1: Write the failing tests**

`tests/rate-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allowRequest, MemoryRateStore } from '../src/lib/rate-limit';

describe('allowRequest', () => {
  it('allows requests under the limit', async () => {
    const store = new MemoryRateStore();
    expect(await allowRequest(store, 'k', 3, 60_000, 1_000)).toBe(true);
    expect(await allowRequest(store, 'k', 3, 60_000, 2_000)).toBe(true);
    expect(await allowRequest(store, 'k', 3, 60_000, 3_000)).toBe(true);
  });

  it('blocks the request over the limit within the window', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'k', 3, 60_000, 1_000 + i);
    expect(await allowRequest(store, 'k', 3, 60_000, 5_000)).toBe(false);
  });

  it('allows again after the window has passed', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'k', 3, 60_000, 1_000 + i);
    expect(await allowRequest(store, 'k', 3, 60_000, 62_000)).toBe(true);
  });

  it('tracks keys independently', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'a', 3, 60_000, 1_000 + i);
    expect(await allowRequest(store, 'a', 3, 60_000, 5_000)).toBe(false);
    expect(await allowRequest(store, 'b', 3, 60_000, 5_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/rate-limit'`.

- [ ] **Step 3: Write the implementation**

`src/lib/rate-limit.ts`:

```ts
// Fixed-window rate limiting behind a tiny store interface so the logic is
// unit-testable in memory and backed by D1 in production.

export type RateRecord = { windowStart: number; count: number };

export interface RateStore {
  get(key: string): Promise<RateRecord | null>;
  set(key: string, v: RateRecord): Promise<void>;
}

export async function allowRequest(
  store: RateStore,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<boolean> {
  const rec = await store.get(key);
  if (!rec || now - rec.windowStart >= windowMs) {
    await store.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (rec.count >= limit) return false;
  await store.set(key, { windowStart: rec.windowStart, count: rec.count + 1 });
  return true;
}

export class MemoryRateStore implements RateStore {
  private map = new Map<string, RateRecord>();
  async get(key: string): Promise<RateRecord | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, v: RateRecord): Promise<void> {
    this.map.set(key, v);
  }
}

export class D1RateStore implements RateStore {
  constructor(private db: D1Database) {}
  async get(key: string): Promise<RateRecord | null> {
    const row = await this.db
      .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ window_start: number; count: number }>();
    return row ? { windowStart: row.window_start, count: row.count } : null;
  }
  async set(key: string, v: RateRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`,
      )
      .bind(key, v.windowStart, v.count)
      .run();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: all rate-limit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts tests/rate-limit.test.ts
git commit -m "feat: fixed-window rate limiter with memory and D1 stores"
```

---

### Task 6: Contact form validation (TDD)

**Files:**
- Create: `src/lib/validation/contact.ts`
- Test: `tests/contact-validation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ContactInput = { name?: string; email?: string; message?: string; website?: string }` (`website` is the honeypot).
  - `type ContactResult = { ok: true; spam: false; values: { name: string; email: string; message: string } } | { ok: true; spam: true } | { ok: false; errors: Record<string, string>; values: { name: string; email: string; message: string } }`
  - `validateContact(input: ContactInput): ContactResult`

- [ ] **Step 1: Write the failing tests**

`tests/contact-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateContact } from '../src/lib/validation/contact';

describe('validateContact', () => {
  it('accepts a valid message and trims values', () => {
    const r = validateContact({ name: ' Sue ', email: ' sue@example.com ', message: ' Hello ' });
    expect(r).toEqual({
      ok: true,
      spam: false,
      values: { name: 'Sue', email: 'sue@example.com', message: 'Hello' },
    });
  });

  it('flags filled honeypot as spam without errors', () => {
    const r = validateContact({ email: 'a@b.co', message: 'hi', website: 'http://spam' });
    expect(r).toEqual({ ok: true, spam: true });
  });

  it('requires email with a kind message', () => {
    const r = validateContact({ message: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toContain('email');
  });

  it('rejects a malformed email but preserves typed values', () => {
    const r = validateContact({ email: 'not-an-email', message: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBeTruthy();
      expect(r.values.message).toBe('hi');
      expect(r.values.email).toBe('not-an-email');
    }
  });

  it('requires a message', () => {
    const r = validateContact({ email: 'a@b.co', message: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.message).toBeTruthy();
  });

  it('rejects messages over 5000 characters', () => {
    const r = validateContact({ email: 'a@b.co', message: 'x'.repeat(5001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.message).toBeTruthy();
  });

  it('name is optional', () => {
    const r = validateContact({ email: 'a@b.co', message: 'hi' });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/validation/contact'`.

- [ ] **Step 3: Write the implementation**

`src/lib/validation/contact.ts`:

```ts
export type ContactInput = { name?: string; email?: string; message?: string; website?: string };

export type ContactValues = { name: string; email: string; message: string };

export type ContactResult =
  | { ok: true; spam: false; values: ContactValues }
  | { ok: true; spam: true }
  | { ok: false; errors: Record<string, string>; values: ContactValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: ContactInput): ContactResult {
  // "website" is a honeypot field hidden from humans; only bots fill it.
  if ((input.website ?? '').trim() !== '') return { ok: true, spam: true };

  const values: ContactValues = {
    name: (input.name ?? '').trim(),
    email: (input.email ?? '').trim(),
    message: (input.message ?? '').trim(),
  };

  const errors: Record<string, string> = {};
  if (values.email === '') {
    errors.email = 'Please enter your email address so we can reply to you.';
  } else if (!EMAIL_RE.test(values.email)) {
    errors.email = "That email address doesn't look quite right — please check it.";
  }
  if (values.message === '') {
    errors.message = 'Please write a message so we know how we can help.';
  } else if (values.message.length > 5000) {
    errors.message = 'Your message is a little too long — please shorten it.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return { ok: true, spam: false, values };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: all contact-validation tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/contact.ts tests/contact-validation.test.ts
git commit -m "feat: contact form validation with honeypot"
```

---

### Task 7: Email rendering and sending (TDD for rendering)

**Files:**
- Create: `src/lib/email/render.ts`, `src/lib/email/send.ts`
- Test: `tests/email-render.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `escapeHtml(s: string): string`
  - `type RenderedEmail = { subject: string; html: string; text: string }`
  - `renderContactEmail(values: { name: string; email: string; message: string }): RenderedEmail`
  - `emailShell(title: string, bodyHtml: string): string` — shared large-type HTML wrapper reused by Plans 2–3 for the other four templates.
  - `sendEmail(env: { RESEND_API_KEY: string; EMAIL_FROM: string; EMAIL_REPLY_TO: string }, to: string, email: RenderedEmail): Promise<{ sent: true } | { sent: false; error: string }>` — never throws.

- [ ] **Step 1: Write the failing tests**

`tests/email-render.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { escapeHtml, renderContactEmail } from '../src/lib/email/render';

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml(`<b>&"'</b>`)).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });
});

describe('renderContactEmail', () => {
  const values = { name: 'Sue', email: 'sue@example.com', message: 'Hello <there>' };

  it('has a PII-free subject', () => {
    const r = renderContactEmail(values);
    expect(r.subject).toBe('New message from the website contact form');
    expect(r.subject).not.toContain('Sue');
  });

  it('includes sender and message in html, escaped', () => {
    const r = renderContactEmail(values);
    expect(r.html).toContain('sue@example.com');
    expect(r.html).toContain('Hello &lt;there&gt;');
    expect(r.html).not.toContain('Hello <there>');
  });

  it('includes a plain-text version', () => {
    const r = renderContactEmail(values);
    expect(r.text).toContain('Hello <there>');
    expect(r.text).toContain('sue@example.com');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../src/lib/email/render'`.

- [ ] **Step 3: Write the implementations**

`src/lib/email/render.ts`:

```ts
export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared shell: short, plain, large type. Plans 2-3 reuse this for the
// application-received / approved / denied / sign-in templates.
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#fffdf7;font-family:Georgia,serif;color:#1c1917;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:6px solid #14532d;padding:24px;font-size:18px;line-height:1.6;">
      <h1 style="font-size:22px;color:#14532d;margin-top:0;">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <p style="font-size:15px;color:#57534e;border-top:1px solid #e7e5e4;padding-top:12px;margin-bottom:0;">
        Grant County Holiday Project · 235 W. Elm St., Lancaster WI 53813 · 608-723-2136 ext 1194
      </p>
    </div>
  </body>
</html>`;
}

export function renderContactEmail(values: {
  name: string;
  email: string;
  message: string;
}): RenderedEmail {
  const subject = 'New message from the website contact form';
  const nameLine = values.name === '' ? '(no name given)' : values.name;
  const html = emailShell(
    'New contact form message',
    `<p><strong>From:</strong> ${escapeHtml(nameLine)} &lt;${escapeHtml(values.email)}&gt;</p>
     <p style="white-space:pre-wrap;">${escapeHtml(values.message)}</p>
     <p>Reply directly to this email to answer them.</p>`,
  );
  const text = `New contact form message\n\nFrom: ${nameLine} <${values.email}>\n\n${values.message}\n\nReply directly to this email to answer them.`;
  return { subject, html, text };
}
```

`src/lib/email/send.ts`:

```ts
import type { RenderedEmail } from './render';

export type SendResult = { sent: true } | { sent: false; error: string };

type EmailEnv = { RESEND_API_KEY: string; EMAIL_FROM: string; EMAIL_REPLY_TO: string };

// Thin Resend REST call. Never throws — callers surface failure in plain
// words and never lose data over an email problem (spec §7).
export async function sendEmail(env: EmailEnv, to: string, email: RenderedEmail): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        reply_to: env.EMAIL_REPLY_TO,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend responded ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: all email-render tests PASS (full suite green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email tests/email-render.test.ts
git commit -m "feat: email shell, contact template, and Resend sender"
```

---

### Task 8: Static pages — Donate, Pay It Forward, Apply (closed stub)

**Files:**
- Create: `src/pages/donate.astro`, `src/pages/pay-it-forward.astro`, `src/pages/apply.astro`

**Interfaces:**
- Consumes: `Site` layout (Task 3).
- Produces: `/donate`, `/pay-it-forward` (both prerendered), `/apply` (prerendered stub — Plan 2 replaces this file with the real form; until then it shows the fallbacks and October 1 message).

- [ ] **Step 1: Write the Donate page**

`src/pages/donate.astro`:

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
export const prerender = true;
---
<Site title="Donate">
  <h1 class="text-3xl font-bold text-holly-800">How to Give</h1>
  <p class="mt-4">
    Your donations are what make the Grant County Holiday Project possible. Every gift goes to
    Grant County families and elderly neighbors during the holidays. Thank you.
  </p>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">Mail a check</h2>
  <p class="mt-2">Make checks payable to <strong>Grant County Holiday Project</strong> and mail to:</p>
  <p class="mt-2 rounded border-l-4 border-gold-500 bg-white p-4 font-semibold">
    Grant County Holiday Project<br />235 W. Elm St.<br />Lancaster WI 53813
  </p>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">Drop off gifts or clothing</h2>
  <p class="mt-2">We accept donated gift and clothing items starting <strong>October 1</strong> at two Allegiant Oil locations:</p>
  <ul class="mt-2 list-disc space-y-2 pl-6">
    <li>190 N 2nd St, Platteville WI — Monday–Friday, 6:00 AM–6:00 PM</li>
    <li>1486 Industrial Park Rd, Lancaster WI — Monday–Friday, 7:00 AM–5:00 PM</li>
  </ul>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">Give online</h2>
  <p class="mt-2">You can donate by card through PayPal. Your donation goes to the Grant County Holiday Project's PayPal account.</p>
  <form action="https://www.paypal.com/cgi-bin/webscr" method="post" class="mt-4">
    <input type="hidden" name="cmd" value="_s-xclick" />
    <input type="hidden" name="hosted_button_id" value="AX2RXSFRCFKZQ" />
    <button
      type="submit"
      class="rounded-lg bg-berry-700 px-6 py-3 text-lg font-bold text-white hover:bg-berry-800"
    >
      Donate online with PayPal
    </button>
  </form>

  <p class="mt-8">
    Questions? Call our message line at <strong>608-723-2136 ext 1194</strong> and leave your name
    and phone number.
  </p>
</Site>
```

- [ ] **Step 2: Write the Pay It Forward page**

`src/pages/pay-it-forward.astro`:

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
export const prerender = true;
---
<Site title="Pay It Forward">
  <h1 class="text-3xl font-bold text-holly-800">Pay It Forward</h1>
  <p class="mt-4">
    The Holiday Project runs on kindness — and everyone has some to give. To receive gifts from
    the Holiday Project, we ask you to share a little kindness in your own community first. It
    doesn't cost money. It just takes heart.
  </p>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">How it works</h2>
  <p class="mt-2">
    When you apply, you'll tell us about a good deed you've done for someone in your community.
    When you do your kind act, feel free to tell the person it's part of the Holiday Project's
    Pay It Forward program — caring and giving, all year round.
  </p>
  <p class="mt-2">
    One thing to know: helping your own family members, or work you're paid for, doesn't count
    for this — the idea is to reach someone new.
  </p>

  <h2 class="mt-8 text-2xl font-bold text-holly-800">Ideas for good deeds</h2>
  <ul class="mt-2 list-disc space-y-1 pl-6">
    <li>Call or visit a lonely neighbor</li>
    <li>Help someone carry their groceries</li>
    <li>Shovel a neighbor's snow</li>
    <li>Give someone a ride to the store</li>
    <li>Visit a nursing home</li>
    <li>Make dinner for someone who is sick</li>
    <li>Babysit for free</li>
    <li>Text someone to say you're thinking of them</li>
  </ul>

  <p class="mt-8">
    Ready? <a href="/apply" class="font-semibold text-berry-700 underline">Start your application</a>.
  </p>
</Site>
```

- [ ] **Step 3: Write the Apply stub**

`src/pages/apply.astro` (Plan 2 replaces this file with the real form):

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
export const prerender = true;
---
<Site title="Apply">
  <h1 class="text-3xl font-bold text-holly-800">Apply for Holiday Help</h1>
  <p class="mt-4">
    Applications open on <strong>October 1</strong> each year. The online application will be
    available right here when applications open.
  </p>
  <div class="mt-6 rounded border-l-4 border-berry-700 bg-white p-4">
    <h2 class="text-xl font-bold text-holly-800">You can always apply these two ways:</h2>
    <ul class="mt-2 list-disc space-y-2 pl-6">
      <li>
        <strong>By phone:</strong> call our message line at <strong>608-723-2136 ext 1194</strong>.
        Speak slowly and leave your name, address, and whether you are a family or elderly
        household. We'll mail you a paper application.
      </li>
      <li>
        <strong>On paper:</strong>
        <a href="/application.pdf" class="font-semibold text-berry-700 underline">print the paper application</a>
        and mail it to 235 W. Elm St., Lancaster WI 53813.
      </li>
    </ul>
  </div>
  <p class="mt-6">
    Your information is always private. We use it only to prepare your family's gifts.
  </p>
</Site>
```

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: `Complete!`; `dist/` contains prerendered `donate`, `pay-it-forward`, `apply` pages.

```bash
git add src/pages/donate.astro src/pages/pay-it-forward.astro src/pages/apply.astro
git commit -m "feat: donate, pay-it-forward, and apply-stub pages"
```

---

### Task 9: Home page (server-rendered)

**Files:**
- Create: `src/lib/db.ts`
- Modify: `src/pages/index.astro` (replace the Task 1 placeholder entirely)

**Interfaces:**
- Consumes: `content_blocks` seed (Task 2), `Site` layout (Task 3).
- Produces: `listContentBlocks(db: D1Database): Promise<ContentBlock[]>` with `type ContentBlock = { id: number; title: string; subtitle: string; body: string }` in `src/lib/db.ts` (later tasks add more helpers to this file).

- [ ] **Step 1: Write the db helper**

`src/lib/db.ts`:

```ts
export type ContentBlock = { id: number; title: string; subtitle: string; body: string };

export async function listContentBlocks(db: D1Database): Promise<ContentBlock[]> {
  const { results } = await db
    .prepare(
      'SELECT id, title, subtitle, body FROM content_blocks WHERE deleted_at IS NULL ORDER BY sort_order, id',
    )
    .all<ContentBlock>();
  return results;
}
```

- [ ] **Step 2: Write the Home page**

Replace `src/pages/index.astro` with:

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
import { listContentBlocks } from '../lib/db';
export const prerender = false;

const blocks = await listContentBlocks(Astro.locals.runtime.env.DB);
---
<Site title="Home">
  <h1 class="text-3xl font-bold text-holly-800">Welcome to the Grant County Holiday Project</h1>
  <p class="mt-4">
    Our mission is to seek out and provide food, clothing, gifts, and toys to children and
    elderly neighbors in Grant County who might otherwise go without during the holidays.
  </p>
  <p class="mt-3">
    More than thirty years ago, the Holiday Project began by giving out donated used items and
    food. Today — with the help of our generous donors and the Tri-State Toys for Tots program
    of Dubuque, Iowa — we provide new clothing and toys to over 400 Grant County families every
    season. We are run entirely by volunteers and funded entirely by donations.
  </p>

  <div class="mt-8 grid gap-4 sm:grid-cols-2">
    <a href="/apply" class="block rounded-lg border-2 border-holly-700 bg-white p-5 hover:bg-holly-100">
      <span class="text-xl font-bold text-holly-800">Need holiday help?</span>
      <span class="mt-1 block">Apply online, by phone, or on paper. Applications open October 1.</span>
    </a>
    <a href="/donate" class="block rounded-lg border-2 border-berry-700 bg-white p-5 hover:bg-holly-100">
      <span class="text-xl font-bold text-berry-800">Want to give?</span>
      <span class="mt-1 block">Mail a check, drop off gifts, or donate online.</span>
    </a>
  </div>

  <section aria-labelledby="news" class="mt-10">
    <h2 id="news" class="text-2xl font-bold text-holly-800">This Year's News</h2>
    {
      blocks.map((b) => (
        <article class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4">
          <h3 class="text-xl font-bold">{b.title}</h3>
          {b.subtitle !== '' && <p class="font-semibold text-stone-600">{b.subtitle}</p>}
          <p class="mt-2 whitespace-pre-wrap">{b.body}</p>
        </article>
      ))
    }
  </section>

  <section aria-labelledby="links" class="mt-10">
    <h2 id="links" class="text-2xl font-bold text-holly-800">Helpful Links</h2>
    <ul class="mt-2 list-disc space-y-1 pl-6">
      <li><a href="/pickup" class="font-semibold text-berry-700 underline">This year's pickup schedule</a></li>
      <li><a href="/application.pdf" class="font-semibold text-berry-700 underline">Print the paper application</a></li>
      <li><a href="/pay-it-forward" class="font-semibold text-berry-700 underline">About Pay It Forward</a></li>
    </ul>
  </section>

  <p class="mt-10 flex items-center gap-4 rounded bg-white p-4">
    <img src="/images/toys-for-tots.gif" alt="Toys for Tots logo" width="100" />
    <span>Toys donated by Toys for Tots, Dubuque IA. Thank you!</span>
  </p>
</Site>
```

- [ ] **Step 3: Verify against local D1**

Run: `npm run dev` (leave running), then in a second terminal:

Run: `curl -s http://localhost:4321/ | grep -o "Special Gifts List"`
Expected: `Special Gifts List` (content block rendered from local D1).

Run: `curl -s http://localhost:4321/ | grep -o "235 W. Elm St."`
Expected: `235 W. Elm St.` (footer). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/pages/index.astro
git commit -m "feat: server-rendered home page with news blocks"
```

---

### Task 10: Pickup schedule page (server-rendered)

**Files:**
- Modify: `src/lib/db.ts` (add two helpers)
- Create: `src/pages/pickup.astro`

**Interfaces:**
- Consumes: `settings` + `pickup_days` seeds (Task 2), `Site` layout.
- Produces (added to `src/lib/db.ts`):
  - `type Settings = { applications_open: number; pickup_title: string; pickup_intro: string; pickup_footer: string; pdf_uploaded_at: string | null }`
  - `getSettings(db: D1Database): Promise<Settings>`
  - `type PickupDay = { id: number; date_text: string; description: string }`
  - `listPickupDays(db: D1Database): Promise<PickupDay[]>`

- [ ] **Step 1: Add the db helpers**

Append to `src/lib/db.ts`:

```ts
export type Settings = {
  applications_open: number;
  pickup_title: string;
  pickup_intro: string;
  pickup_footer: string;
  pdf_uploaded_at: string | null;
};

export async function getSettings(db: D1Database): Promise<Settings> {
  const row = await db
    .prepare(
      'SELECT applications_open, pickup_title, pickup_intro, pickup_footer, pdf_uploaded_at FROM settings WHERE id = 1',
    )
    .first<Settings>();
  if (!row) throw new Error('settings row missing — run migrations');
  return row;
}

export type PickupDay = { id: number; date_text: string; description: string };

export async function listPickupDays(db: D1Database): Promise<PickupDay[]> {
  const { results } = await db
    .prepare(
      'SELECT id, date_text, description FROM pickup_days WHERE deleted_at IS NULL ORDER BY sort_order, id',
    )
    .all<PickupDay>();
  return results;
}
```

- [ ] **Step 2: Write the pickup page**

`src/pages/pickup.astro`:

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
import { getSettings, listPickupDays } from '../lib/db';
export const prerender = false;

const db = Astro.locals.runtime.env.DB;
const settings = await getSettings(db);
const days = await listPickupDays(db);
---
<Site title="Pickup Schedule">
  <h1 class="text-3xl font-bold text-holly-800">Pickup Schedule</h1>
  <p class="mt-4 text-xl font-semibold">{settings.pickup_title}</p>
  <p class="mt-3 whitespace-pre-wrap">{settings.pickup_intro}</p>

  <table class="mt-6 w-full border-collapse bg-white text-left">
    <caption class="sr-only">Pickup dates and the towns each date serves</caption>
    <thead>
      <tr>
        <th scope="col" class="border-b-2 border-holly-700 p-3 text-holly-800">Date</th>
        <th scope="col" class="border-b-2 border-holly-700 p-3 text-holly-800">Who picks up / time</th>
      </tr>
    </thead>
    <tbody>
      {
        days.map((d) => (
          <tr>
            <td class="border-b border-stone-200 p-3 font-semibold whitespace-nowrap">{d.date_text}</td>
            <td class="border-b border-stone-200 p-3">{d.description}</td>
          </tr>
        ))
      }
    </tbody>
  </table>

  <p class="mt-6 whitespace-pre-wrap font-semibold">{settings.pickup_footer}</p>
</Site>

<style>
  @media print {
    :global(header),
    :global(footer) {
      display: none;
    }
  }
</style>
```

- [ ] **Step 3: Verify**

Run: `npm run dev` (leave running), second terminal:

Run: `curl -s http://localhost:4321/pickup | grep -o "Tuesday Dec 2nd"`
Expected: `Tuesday Dec 2nd`. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/pages/pickup.astro
git commit -m "feat: server-rendered pickup schedule page"
```

---

### Task 11: Contact page with working form

**Files:**
- Modify: `src/lib/db.ts` (add `insertContactMessage`)
- Create: `src/pages/contact.astro`

**Interfaces:**
- Consumes: `validateContact` (Task 6), `newCsrfCookieValue`/`csrfTokenFor`/`verifyCsrf` (Task 4), `allowRequest`/`D1RateStore` (Task 5), `renderContactEmail`/`sendEmail` (Task 7), `contact_messages` table (Task 2).
- Produces: `/contact` GET (form) + POST (same route). `insertContactMessage(db: D1Database, v: { name: string; email: string; message: string }): Promise<void>` added to `src/lib/db.ts`.

- [ ] **Step 1: Add the db helper**

Append to `src/lib/db.ts`:

```ts
export async function insertContactMessage(
  db: D1Database,
  v: { name: string; email: string; message: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO contact_messages (received_at, name, email, message) VALUES (?, ?, ?, ?)')
    .bind(new Date().toISOString(), v.name, v.email, v.message)
    .run();
}
```

- [ ] **Step 2: Write the contact page**

`src/pages/contact.astro`:

```astro
---
import '../styles/global.css';
import Site from '../layouts/Site.astro';
import { validateContact, type ContactValues } from '../lib/validation/contact';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../lib/csrf';
import { allowRequest, D1RateStore } from '../lib/rate-limit';
import { renderContactEmail } from '../lib/email/render';
import { sendEmail } from '../lib/email/send';
import { insertContactMessage } from '../lib/db';
export const prerender = false;

const env = Astro.locals.runtime.env;

let values: ContactValues = { name: '', email: '', message: '' };
let errors: Record<string, string> = {};
let sent = false;
let emailNote = '';

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const okCsrf = await verifyCsrf(
    env.CSRF_SECRET,
    Astro.cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  const ip = Astro.request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const okRate = await allowRequest(
    new D1RateStore(env.DB),
    `contact:${ip}`,
    5,
    10 * 60_000,
    Date.now(),
  );
  const result = validateContact({
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    message: String(form.get('message') ?? ''),
    website: String(form.get('website') ?? ''),
  });

  if (!okCsrf || !okRate || (result.ok && result.spam)) {
    // Show success without saving: never tell a bot it was caught, and never
    // let a stale token or rate limit turn into a scary error for a human.
    sent = true;
  } else if (result.ok) {
    await insertContactMessage(env.DB, result.values);
    const outcome = await sendEmail(env, env.CONTACT_TO, renderContactEmail(result.values));
    if (!outcome.sent) {
      emailNote = 'Your message is saved and our volunteers will still see it.';
    }
    sent = true;
  } else {
    errors = result.errors;
    values = result.values;
  }
}

const cookieValue = newCsrfCookieValue();
Astro.cookies.set('csrf', cookieValue, {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: true,
});
const csrfToken = await csrfTokenFor(env.CSRF_SECRET, cookieValue);
---
<Site title="Contact Us">
  <h1 class="text-3xl font-bold text-holly-800">Contact Us</h1>

  {
    sent ? (
      <div class="mt-6 rounded border-l-4 border-holly-700 bg-white p-5">
        <p class="text-xl font-bold text-holly-800">Thank you — we got your message.</p>
        <p class="mt-2">A volunteer will reply to your email as soon as they can. {emailNote}</p>
        <p class="mt-2">
          If it's urgent, call our message line at <strong>608-723-2136 ext 1194</strong>.
        </p>
      </div>
    ) : (
      <>
        <p class="mt-4">
          Send us a message and a volunteer will reply by email. You can also call our message
          line at <strong>608-723-2136 ext 1194</strong> — speak slowly and leave your name and
          phone number.
        </p>

        {Object.keys(errors).length > 0 && (
          <div class="mt-4 rounded border-l-4 border-berry-700 bg-white p-4" role="alert">
            <p class="font-bold">Please check these before sending:</p>
            <ul class="mt-1 list-disc pl-6">
              {Object.entries(errors).map(([field, msg]) => (
                <li>
                  <a href={`#${field}`} class="text-berry-700 underline">
                    {msg}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form method="post" class="mt-6 max-w-xl space-y-5" novalidate>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <p class="hidden" aria-hidden="true">
            <label>Leave this box empty: <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
          </p>

          <div>
            <label for="name" class="block font-semibold">Your name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={values.name}
              autocomplete="name"
              class="mt-1 w-full rounded border-2 border-stone-400 bg-white p-3"
            />
          </div>

          <div>
            <label for="email" class="block font-semibold">Your email address <span class="text-berry-700">(required)</span></label>
            <input
              type="email"
              id="email"
              name="email"
              value={values.email}
              autocomplete="email"
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              class="mt-1 w-full rounded border-2 border-stone-400 bg-white p-3"
            />
            {errors.email && <p id="email-error" class="mt-1 font-semibold text-berry-800">{errors.email}</p>}
          </div>

          <div>
            <label for="message" class="block font-semibold">Your message <span class="text-berry-700">(required)</span></label>
            <textarea
              id="message"
              name="message"
              rows="6"
              aria-invalid={errors.message ? 'true' : undefined}
              aria-describedby={errors.message ? 'message-error' : undefined}
              class="mt-1 w-full rounded border-2 border-stone-400 bg-white p-3">{values.message}</textarea>
            {errors.message && <p id="message-error" class="mt-1 font-semibold text-berry-800">{errors.message}</p>}
          </div>

          <button
            type="submit"
            class="rounded-lg bg-holly-700 px-6 py-3 text-lg font-bold text-white hover:bg-holly-900"
          >
            Send message
          </button>
        </form>
      </>
    )
  }
</Site>
```

- [ ] **Step 3: Verify the full round trip**

Run: `npm run dev` (leave running), second terminal:

Run: `curl -s http://localhost:4321/contact | grep -o 'name="csrf_token" value="[0-9a-f]*"' | head -1`
Expected: a `csrf_token` with a 64-char hex value.

Run (missing message → kind error, values preserved):

```bash
COOKIE_JAR=$(mktemp)
TOKEN=$(curl -s -c "$COOKIE_JAR" http://localhost:4321/contact | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}')
curl -s -b "$COOKIE_JAR" -d "csrf_token=$TOKEN&email=sue@example.com&message=" http://localhost:4321/contact | grep -o "Please write a message"
```

Expected: `Please write a message`.

Run (valid submission — email send will fail without a real key; the page must still show success):

```bash
TOKEN=$(curl -s -c "$COOKIE_JAR" http://localhost:4321/contact | grep -o 'name="csrf_token" value="[0-9a-f]*"' | grep -o '[0-9a-f]\{64\}')
curl -s -b "$COOKIE_JAR" -d "csrf_token=$TOKEN&email=sue@example.com&message=Hello there" http://localhost:4321/contact | grep -o "we got your message"
```

Expected: `we got your message`.

Run: `npx wrangler d1 execute gchp --local --command "SELECT email, message FROM contact_messages ORDER BY id DESC LIMIT 1"`
Expected: `sue@example.com` / `Hello there`. Stop the dev server.

- [ ] **Step 4: Run the test suite and commit**

Run: `npm run test`
Expected: all tests PASS.

```bash
git add src/lib/db.ts src/pages/contact.astro
git commit -m "feat: contact page with CSRF, rate limit, honeypot, D1 save, and email"
```

---

### Task 12: Paper-application PDF route and security headers

**Files:**
- Create: `src/pages/application.pdf.ts`, `src/middleware.ts`

**Interfaces:**
- Consumes: `FILES` R2 binding (Task 1).
- Produces: GET `/application.pdf` streaming the R2 object `application.pdf`; `src/middleware.ts` adding security headers to every response (Plan 3's admin pages inherit the `/admin` no-store rule).

- [ ] **Step 1: Write the PDF route**

`src/pages/application.pdf.ts`:

```ts
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const obj = await locals.runtime.env.FILES.get('application.pdf');
  if (!obj) {
    return new Response(
      'The paper application is not available right now. Please call 608-723-2136 ext 1194 and we will mail you one.',
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="GCHP-application.pdf"',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
```

- [ ] **Step 2: Write the middleware**

`src/middleware.ts`:

```ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const res = await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self' https://www.paypal.com; frame-ancestors 'none'; base-uri 'self'",
  );
  if (context.url.pathname.startsWith('/admin')) {
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
});
```

- [ ] **Step 3: Load a PDF into local R2 and verify**

```bash
npx wrangler r2 object put gchp-files/application.pdf --file "legacy/public_html/PDFapplication.pdf" --local
```

Run: `npm run dev` (leave running), second terminal:

Run: `curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:4321/application.pdf`
Expected: `200 application/pdf`.

Run: `curl -s -o /dev/null -w "%{http_code}" -D - http://localhost:4321/ | grep -i "content-security-policy" | head -1`
Expected: the CSP header line is present. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/application.pdf.ts src/middleware.ts
git commit -m "feat: paper application PDF route and security headers"
```

---

### Task 13: Deployment guide

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the repo's README with exact production-setup commands. No code changes.

- [ ] **Step 1: Write the README**

`README.md`:

```markdown
# Grant County Holiday Project — Website

Volunteer-run charity site for Grant County, WI. Astro + Tailwind on Cloudflare Pages,
data in Cloudflare D1, files in R2, email via Resend. See `CLAUDE.md` for project rules,
`docs/superpowers/specs/` for the design spec, and `docs/legacy-inventory.md` for how the
old PHP site worked.

## Local development

1. `npm install`
2. `cp .dev.vars.example .dev.vars` and fill in values (any random string works for
   `CSRF_SECRET` in dev; a real `RESEND_API_KEY` is only needed to test email sending).
3. `npm run db:migrate:local`
4. `npx wrangler r2 object put gchp-files/application.pdf --file "legacy/public_html/PDFapplication.pdf" --local`
5. `npm run dev` → http://localhost:4321

Tests: `npm run test`. Build: `npm run build`.

## Production setup (one time)

1. **Create the database:** `npx wrangler d1 create gchp` — paste the printed
   `database_id` into `wrangler.toml`, commit.
2. **Apply migrations:** `npm run db:migrate:remote`
3. **Create the bucket:** `npx wrangler r2 bucket create gchp-files`
4. **Upload the paper application:**
   `npx wrangler r2 object put gchp-files/application.pdf --file "legacy/public_html/PDFapplication.pdf" --remote`
5. **Create the Pages project:** Cloudflare dashboard → Workers & Pages → Create →
   Pages → connect this GitHub repo. Build command `npm run build`, output `dist`.
   Production branch `main` (PRs get preview URLs automatically).
6. **Bind resources:** Pages project → Settings → Bindings: D1 `DB` → `gchp`,
   R2 `FILES` → `gchp-files`.
7. **Secrets:** Pages project → Settings → Environment variables:
   `RESEND_API_KEY` (from resend.com), `CSRF_SECRET` (long random string, e.g.
   `openssl rand -hex 32`).
8. **Resend domain:** resend.com → Domains → add `grantcountyholidayproject.com` →
   add the DNS records it shows at the current DNS host → wait for "Verified".

## Cutover (later — see Plan 4)

The old PHP site stays live and untouched until the new site is verified. DNS moves at
the current DNS host. Post-cutover: rotate the old admin/MySQL passwords and remove
`gchpManual.pdf` from the old host.
```

- [ ] **Step 2: Final verification**

Run: `npm run test`
Expected: all tests PASS.

Run: `npm run build`
Expected: `Complete!`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: local dev and production deployment guide"
```

---

## Plan 1 exit criteria

- `npm run test` and `npm run build` pass.
- With local migrations applied: `/`, `/donate`, `/apply`, `/pickup`, `/pay-it-forward`, `/contact`, `/application.pdf` all render; the contact form saves to D1 and shows kind errors that preserve input; all pages usable at 360px, with JS disabled, and via keyboard.
- Deployed preview on Cloudflare Pages (owner can do the README setup at any point; not a blocker for starting Plan 2).
- Not in this plan (by design): the real `/apply` form (Plan 2), everything under `/admin` (Plan 3), data migration and DNS cutover (Plan 4).
