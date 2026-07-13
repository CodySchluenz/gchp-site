# Grant County Holiday Project — Replacement Site Design

**Date:** 2026-07-12
**Status:** Approved by owner (design conversation, this date)
**Inputs:** `CLAUDE.md`, `docs/legacy-inventory.md`, `docs/decisions.md`

The replacement for the legacy PHP site: a public site, an online application for
families/elderly, and an admin console operated by one non-technical ~70-year-old volunteer.
Two user roles only: **Admin** (the operator; login may be shared informally) and **Applicant**
(no account, no login).

---

## 1. Stack and architecture

- **Framework:** Astro (static-first, hybrid rendering) + Tailwind CSS.
- **Hosting/deploy:** Cloudflare Pages via GitHub. `main` = production, PRs = preview deploys.
- **Server code:** Astro server endpoints running as Cloudflare Pages Functions
  (`@astrojs/cloudflare` adapter). No separate API layer.
- **Data:** Cloudflare D1 (SQLite), accessed with prepared statements/bindings only.
- **Files:** Cloudflare R2 for exactly one thing — the admin-uploaded paper application PDF.
- **Email:** Resend. Sender `Grant County Holiday Project <no-reply@grantcountyholidayproject.com>`,
  reply-to `skleinow@co.grant.wi.gov`. Domain verification records added at the current DNS host.
- **Runtime dependencies:** Astro, Tailwind, Resend SDK. Nothing else without explicit approval.
  Dev tooling: wrangler, Vitest.

**Rendering split:**
- Static (prerendered): Donate, Pay It Forward.
- Server-rendered (read D1 per request): Home (news blocks), Pickup Schedule, Apply,
  the confirmation page, and everything under `/admin`.
- Public server-rendered pages get short cache headers; `/admin` responses are never cached.

**DNS/domain:** owner controls DNS through the current hosting provider's panel. Cutover and
Resend records are documented as exact record values for the owner to paste in.

---

## 2. Data model (D1)

Season is a plain integer `season_year` stamped at submission (calendar year of `submitted_at`).
There is no season configuration. Data is kept indefinitely (owner decision 10); expected volume
is tiny (well under 1M rows, ever).

Soft-delete pattern: user-manageable records (`applications`, `donors`, `donations`,
`content_blocks`, `pickup_days`) carry `deleted_at` (null = live). Deletes set it; "Undo"
clears it. Nothing purges automatically.

### `applications`
One row per household application.

| Column | Notes |
|---|---|
| `id` | PK |
| `season_year` | int, stamped at submission |
| `status` | `new` \| `approved` \| `denied` |
| `submitted_at` | ISO datetime |
| `first_name`, `last_name` | required |
| `address` | required |
| `city_id` | FK → `cities`, required |
| `phone` | required |
| `email` | required (validated + confirm-match at entry) |
| `diabetic` | bool — someone in household is diabetic |
| `share_with_sponsor` | bool — the renamed "permission to adopt" consent |
| `permanently_disabled` | bool — "is anyone in your household permanently disabled?" |
| `bed_choice` | `sheets` \| `blanket` \| `none` |
| `bed_size` | `twin` \| `full` \| `queen` \| `king`; required unless `bed_choice = none` |
| `full_time_residence_confirmed` | bool, required affirmation |
| `years_received_help` | int, required |
| `adopted_last_year` | bool, required |
| `household_type` | `family` \| `elderly` \| `disabled` — auto-suggested (see §3), admin-editable |
| `no_employment_confirmed` | bool — checked when the household has zero employers |
| Benefits (six pairs, columns): `food_share_amount`; `social_security_amount` + `social_security_for`; `ssi_amount` + `ssi_for`; `child_support_amount` + `child_support_for`; `unemployment_weekly_amount` + `unemployment_for`; `other_income_amount` + `other_income_for` | amount null = "we don't receive this" (explicitly checked); otherwise a number (0 allowed) |
| `good_deed` | text, required, no truncation |
| `may_not_be_eligible` | bool, computed at submission (see §3), informational only |
| `pu_number` | int, null until approved; auto-assigned next number within `season_year`; admin-editable |
| `bags_count` | int, admin-entered later |
| `deleted_at` | soft delete |

### `household_members`
One row per person (adults and children uniformly). `application_id` FK; `position` (1 = the
applicant, prefilled); `name` (required); `relationship` to head of household (required;
person 1 = "self"); `sex` (required); `age` (required); sizes `pants`, `shirt_top`, `underwear`,
`socks`, `diapers` (each free text; blank = not needed); `gifts` (text).

### `employers`
Dynamic list per application. `application_id` FK; `employer_name`, `worker_name`,
`hourly_wage`, `hours_per_week` — all four required per row. A row is only present if the
household has employment; otherwise `applications.no_employment_confirmed` must be true.

### `donors` and `donations`
`donors`: name, contact person, address, city, state, zip, phone, email, `deleted_at`.
`donations`: `donor_id` FK, `date`, `item_description`, `amount` (either/both of item and
amount may be filled), `deleted_at`.

### Content tables
- `content_blocks`: `title`, `subtitle`, `body`, `sort_order`, `deleted_at` — the homepage
  "Latest News" blocks (this year's info, special gifts list, key dates).
- `pickup_days`: `sort_order`, `date_text`, `description`, `deleted_at` — one row per schedule
  line.
- `settings` (single row): `applications_open` (bool — the switch), `pickup_title`,
  `pickup_intro`, `pickup_footer`, `pdf_uploaded_at` (display only).

### Reference and system tables
- `cities`: the 24 Grant County towns + zips, seeded from legacy.
- `contact_messages`: `received_at`, `name`, `email`, `message`, `read_at`.
- `admin_emails`: allow-list. Initial rows: `skleinow@co.grant.wi.gov`, `codydps@gmail.com`.
  No admin UI for this list (developer-managed).
- `login_tokens`: `token_hash`, `email`, `expires_at` (15 min), `used_at`.
- `sessions`: `session_hash`, `email`, `created_at`, `expires_at` (30 days, renewed on use).

Tokens and session IDs are random ≥256-bit values stored **hashed**. No passwords exist anywhere.

---

## 3. Applicant experience (`/apply`)

**Shape:** one scrollable page, one Submit. No wizard, no session, no drafts. "Add another
person/employer" is a real submit button that re-renders the page with one more blank row and
every typed value preserved; with JS enabled the row is added instantly instead. All validation
is server-side; JS only enhances (inline hints, instant rows). The page works fully with
JavaScript disabled. Mobile-first; tested at 360px; WCAG 2.2 AA; large type and tap targets;
plain warm language at a low reading level.

**Season gate:** when `applications_open` is false, GET `/apply` shows a warm closed message
("Applications open October 1…") with the phone line and PDF links; POST is rejected. When open,
the page opens with, before any fields:
1. Privacy reassurance: answers are private, used only to prepare the family's gifts.
2. The two fallbacks, prominent: message line **608-723-2136 ext 1194** and the printable paper
   application (served from R2).
3. The eligibility note stated kindly, including: single or married individuals without children
   are not eligible unless permanently disabled or over 65.

**Form sections and fields** (\* = required):

1. **About you** — first name\*, last name\*, address\*, city\* (dropdown, 24 towns), phone\*,
   email\* + confirm email\* (must match — actually validated), "someone in my household is
   diabetic" (checkbox), "is anyone in your household permanently disabled?"\* (yes/no),
   sponsor permission (checkbox, worded plainly: "A generous neighbor may sponsor your family.
   They will never be told your name — only what your family needs. May we share your needs this
   way?"), full-time-residence confirmation\*, years you have received help from the project\*,
   were you sponsored ("adopted") last year?\*.
2. **Bedding** — "Would you like sheets or a blanket?" as three large buttons: Sheets / Blanket /
   No thank you\*. Bed size\* (twin/full/queen/king) required unless "No thank you."
3. **Work & income** — employer rows; each row requires employer name\*, worker's name\*, hourly
   wage\*, hours per week\*. "Add another employer." If no rows: "No one in our household is
   currently employed"\* must be checked (legal requirement: income is always explicitly
   answered).
4. **Benefits** — six rows (Food Share; Social Security; SSI; Child support; Weekly
   unemployment; Other income). Each row requires either an amount (+ "for whom" on all but Food
   Share) or its "we don't receive this" checkbox — "required" never means inventing a number.
5. **Your household** — one card per person, adults and children uniformly. Person 1 is
   prefilled as the applicant ("self"). Per person: name\*, relationship to head of household\*,
   sex\*, age\*, clothing sizes (pants, shirt/top, underwear, socks, diapers — blank = not
   needed), gifts/toys wanted. "Add another person."
6. **Pay it forward** — the requirement explained warmly with examples ("helping family members
   or paid work doesn't count" phrased kindly), one required good-deed text box\*, no length
   truncation.

**Validation errors:** re-render the same page with every value preserved, an error summary at
the top linking to each field, and kind, specific messages ("We need your phone number so we can
reach you about pickup"). Errors never wipe input.

**Eligibility flag (never blocks):** computed at submission —
`may_not_be_eligible = (no member with age < 18) AND (person 1's age < 65) AND (NOT permanently_disabled)`.
The application is accepted regardless; the flag is shown only to the admin as "Check
eligibility" in words.

**`household_type` auto-suggestion:** `disabled` if `permanently_disabled`; else `elderly` if
person 1's age ≥ 65; else `family`. Admin-editable on the application view.

**After Submit:**
- Confirmation page: "We received your application. Here's what happens next…" — review by
  volunteers, an email when approved, the pickup slip, pickup dates in December. Restates that
  their information is private. No reference number needed.
- Immediate "Application received" email via Resend (if email deliverable failure occurs, the
  application is still saved; failures never block submission).

**Abuse controls:** honeypot field + lightweight per-IP rate limit. No CAPTCHAs (they defeat
exactly this audience).

---

## 4. Public site

Shared look: light, bright, holiday-themed; recognizably the same beloved project, modernized.
Light backgrounds with red/green/gold accents; tasteful festive touches; no autoplay media, no
heavy animation; any decoration is CSS-only and harmless with JS off. WCAG 2.2 AA contrast.
Mailing address everywhere: **235 W. Elm St., Lancaster WI 53813** (owner-confirmed).
No third-party tracking or analytics of any kind.

- **Home (`/`)** — mission + 30-years history; Tri-State Toys for Tots (Dubuque, IA) credit +
  logo; key dates (donations and applications open October 1); donation summary (drop-off sites,
  checks payable to the project, 235 address); the `content_blocks` news; prominent links to
  Apply, Pickup Schedule, paper application, and the phone line; Grant County website link.
- **Donate (`/donate`)** — mail-a-check (235), the two Allegiant Oil drop-off sites with hours
  (190 N 2nd St Platteville, Mon–Fri 6a–6p; 1486 Industrial Park Rd Lancaster, Mon–Fri 7a–5p),
  cash guidance, PayPal button paying the "Grant County Holiday Project" PayPal account. The old
  public "add yourself as a donor" form is **retired** (unauthenticated DB write, actively
  spammed). Donors are recorded by the admin.
- **Apply (`/apply`)** — §3.
- **Pickup schedule (`/pickup`)** — `pickup_title`, `pickup_intro`, the `pickup_days` rows,
  `pickup_footer`. Readable on a phone; print-friendly.
- **Pay it forward (`/pay-it-forward`)** — the explainer, rewritten warmly, linking to Apply.
- **Contact (`/contact`)** — name, email\*, message\*. On submit: writes `contact_messages` AND
  emails the operator. Honeypot + rate limit. Confirmation message on the page.
- **Paper application (`/application.pdf`)** — served from R2; always the admin's newest upload.

---

## 5. Admin console (`/admin`)

Design rules for every screen: 18–20px minimum type, high contrast, generous spacing and tap
targets, plain English (say "Download list for Excel", "Applications this year"), text labels on
every button (never icon-only), one clear primary action per screen, an obvious **Back**, a one-
or two-sentence **Help** note per screen, confirmation before anything destructive, soft delete
with visible "Undo" for applications/donors/donations/content. Light festive header; otherwise
calm and plain. Assume a laptop/desktop screen but keep it responsive.

**Screens:**

1. **Sign in** — "Type your email address" → "Email me a sign-in link" → check-your-email
   message. Always the same response wording regardless of whether the email is allowed.
2. **Admin Home** — big labeled buttons: **Applications this year** (primary), **Pickup
   schedule**, **This year's news & gifts list**, **Donors & donations**, **Messages**, plus a
   status card: "Applications are OPEN/CLOSED" with the toggle button (confirmation prompt).
   Sign out link.
3. **Applications list** — defaults to current season, newest first. Tabs: **To review /
   Approved / Denied / All**. Name search. Buttons: **Download list for Excel** (CSV),
   **Print this list** (print stylesheet). "Previous years" dropdown once history exists.
   Rows show name, city, date, status, and "Check eligibility" text when flagged.
4. **Application view** — readable summary (not a form): household details, members table with
   sizes/gifts, income, benefits, good deed, flags (diabetic, sponsor consent), eligibility
   banner if flagged, `household_type` (editable dropdown). Actions:
   - **Approve** — assigns next `pu_number` in the season, then asks "Send [name] their approval
     email?" (Send / Skip).
   - **Deny** — same pattern with the deny email (Send / Skip).
   - **Edit** — a pre-filled form matching the applicant form (plus PU#, bags, household type).
   - **Print pickup slip**.
   - **Delete this application** — confirm + Undo.
5. **Pickup slip** — print-formatted page: PU#, "Bags: ____" (blank line, or the number if
   entered), household name/address/phone/count, member table (name, sex, age, sizes, gifts),
   bed choice/size, diabetic and sponsor flags. Plus **Print all approved slips** (batch for the
   current season, ordered by PU#).
6. **This year's news & gifts list** — the `content_blocks` editor: list, add, edit (title,
   subtitle, text), remove (confirm + undo), reorder. No ID numbers exposed.
7. **Pickup schedule** — edit title, intro, footer; add/edit/remove/reorder date+description
   rows.
8. **Paper application** — "Update the paper application": upload a PDF (PDF-only, size-capped),
   shows "Currently published: uploaded {date}". New upload immediately replaces what
   `/application.pdf` serves.
9. **Donors & donations** — donor list with search; add/edit donor; donor page lists their
   donations with **Add a donation** (date, what was given, dollar amount); **Download donations
   for Excel**. Soft delete + undo throughout.
10. **Messages** — contact form submissions, newest first, read/unread.

**Excel exports (CSV, UTF-8, opens in Excel):**
- Applications: one row per application — status, PU#, bags, submitted date, name, address, city,
  phone, email, flags, household type, years received, adopted last year, bed choice/size,
  benefit columns, employment summary, member count, and a readable "members" column
  (names/ages). Current-season by default (matches the visible list/filter).
- Donations: one row per donation with donor details.

**Season close-out:** none. On January 1 the current season rolls over and "Applications this
year" starts empty; prior years remain under "Previous years." No purge exists in the UI.

---

## 6. Auth (custom magic link)

1. Admin enters email at `/admin`. If it matches `admin_emails`, create a single-use token
   (random ≥256-bit; stored hashed; 15-minute expiry) and email the sign-in link. The page
   always shows "If that address is on our list, the link is on its way."
2. Clicking the link validates + consumes the token and sets a session cookie: random ID (stored
   hashed), **HttpOnly, Secure, SameSite=Lax**, 30-day expiry, renewed on use.
3. Every `/admin` route and admin endpoint verifies the session server-side. Sign out deletes
   the session.
4. Login endpoint is rate-limited. Expired/used tokens get a friendly "that link has expired —
   request a fresh one" page.

---

## 7. Security & privacy

- No third-party tracking/analytics. No applicant PII in logs, URLs, or email subject lines.
- CSRF tokens on every state-changing form (public and admin).
- All queries via D1 prepared statements. All output HTML-escaped by Astro defaults.
- Honeypot + per-IP rate limits on the three public endpoints (apply, contact, login).
- Standard security headers (CSP, X-Content-Type-Options, Referrer-Policy, frame-ancestors).
- Secrets (Resend key, etc.) live in Cloudflare env config only — never in the repo.
- Admin responses: `Cache-Control: no-store`.
- Email failures are surfaced to the admin in plain words ("The email could not be sent — their
  application is still saved") and never lose data.

---

## 8. Email templates (Resend)

All short, plain, large-type HTML + text fallback. From
`no-reply@grantcountyholidayproject.com`, reply-to `skleinow@co.grant.wi.gov`.

1. **Application received** — instant on submit: we got it, what happens next, the phone line.
2. **Approved** — admin-triggered: approved; your pickup slip / bring it; pickup dates page link.
3. **Denied** — admin-triggered: kind wording, phone line for questions.
4. **Sign-in link** — the magic link, 15-minute note.
5. **Contact copy** — the contact-form message forwarded to the operator.

---

## 9. Testing & acceptance

- **TDD** (per CLAUDE.md) for all logic: validation rules, eligibility flag, household-type
  suggestion, PU# assignment, CSV generation, token/session lifecycle, rate limiting. Vitest
  unit tests + endpoint tests against a local D1 (wrangler/miniflare).
- Accessibility checks are part of done: 360px layout, keyboard-only operation, labeled
  controls, AA contrast on the light theme.
- Build and full test suite must pass before any task is called done.
- **Launch acceptance tests (blocking):** (a) watch the operator complete every admin task
  unaided — log in, review, approve with email, print a slip, edit the news blocks and pickup
  schedule, download the Excel list, record a donation; (b) watch a non-technical person
  complete the application on an old phone. Fix whatever confuses either of them before cutover.

---

## 10. Migration & cutover

1. Owner provides a fresh MySQL dump at cutover time (handled carefully; deleted after import;
   never committed).
2. One-time migration script converts to D1: 2025-season applications + members + employers +
   benefits + good deeds (`season_year = 2025`; status mapping: reviewed=1 & approved=1 →
   `approved`, reviewed=1 & approved=0 → `denied`, reviewed=0 → `new`), donors
   (obvious spam rows dropped), `content_blocks` from `bar`, `pickup_days` from `pickup`,
   `cities`. Old wide `appEmp` columns split into `employers` rows; text dates parsed to ISO.
3. Verify: record counts per table match the dump (minus dropped spam), spot-check a sample.
4. The old PHP site stays live and untouched until the new site is verified.
5. Cutover: DNS at the current host pointed to Cloudflare Pages; Resend domain records added
   (documented as exact values for the owner).
6. Post-cutover: owner rotates the old admin + MySQL passwords, removes `gchpManual.pdf` from
   the old host, and keeps the old hosting account until the first season on the new site
   completes.

---

## 11. Out of scope (deliberately)

Applicant accounts or saved drafts; Spanish translation; donor self-service; analytics of any
kind; a CMS; multi-admin roles/permissions; automated eligibility rejection; online payment
processing beyond the existing PayPal button; native apps.
