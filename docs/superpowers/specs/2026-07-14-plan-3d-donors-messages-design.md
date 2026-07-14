# Plan 3d — Donors, Donations & Messages (design)

**Date:** 2026-07-14
**Status:** approved (design); spec awaiting owner review before writing-plans
**Depends on:** Plans 1, 2, 3a, 3b, 3c (all merged to `main`)

## Goal
Give the operator two more admin surfaces: a **donor directory with donation tracking**
(donor-centric — open a donor, see their donation history, add donations under them), and a
**contact-messages inbox**. Reuses the editor patterns established in Plans 3b/3c (per-row forms,
Post/Redirect/Get, soft-delete + undo, CSRF, CSP-safe confirms). This completes the admin console;
Plan 4 is data migration + DNS cutover.

## Owner decisions that shaped this
- **Donations are donor-centric:** every donation is recorded under a donor. To record a one-off
  drop-off, she adds the donor (even just a name) first, then adds the donation on the donor page.
- **Donations stay admin-only** — no public total. No change to the public Donate page or the
  PayPal button (from decision #9: keep the donor directory + PayPal).
- **Donors and donations use soft-delete + undo** (both tables have `deleted_at`); **contact
  messages use hard-delete-with-confirm** (no `deleted_at` column, and every message is also in her
  email inbox, so it is low-stakes).
- Donor fields: **only name is required** (contact person, address, city, state, zip, phone, email
  optional) — matches the legacy directory.

## Existing schema (migration 0001 — no schema change needed)
```
donors(id, name NOT NULL, contact_person '', address '', city '', state '', zip '', phone '',
       email '', deleted_at)
donations(id, donor_id NOT NULL → donors(id), date NOT NULL, item_description '', amount REAL, deleted_at)
contact_messages(id, received_at NOT NULL, name '', email NOT NULL, message NOT NULL, read_at)
```
`src/lib/db.ts` already has the public `insertContactMessage`; everything else here is net-new.

## Global constraints (inherited — every task must honor)
- **CSP `script-src 'self'`** — no inline event handlers, no inline `<script>`. Confirms come from
  `data-confirm` + external `public/scripts/print-button.js`.
- **Every mutating admin POST enforces CSRF** (double-submit HMAC via `src/lib/csrf.ts`); on failure
  redirect back with `?error=csrf`, never silently discard. Auth gating is automatic via the
  URL-prefix middleware.
- **Post/Redirect/Get:** every mutation returns a 303 redirect; a refresh must be a GET that cannot
  re-mutate.
- **Operator usability:** admin base font ≥18px (the `Admin` layout body is `text-lg`); text-labeled
  buttons (never icon-only); plain English; one clear primary action; obvious Back; confirm before
  destructive actions.
- **Straight apostrophes only** (`'`).
- **Sensitive PII:** donor and message contact info is PII — never log it; never put it in a redirect
  query string (ids and flags only); gated `/admin` routes only.
- **D1 limits:** ≤100 bound params/statement; no row-count-scaling query fan-out.
- **No new dependencies.** Reuse `escapeLike`, `parseMoney` (from earlier plans).

## Architecture

### A. Donors & donations (donor-centric) — reuse the news/pickup editor pattern

1. **Donors list** — `src/pages/admin/donors/index.astro`.
   - Lists non-deleted donors (name, contact person, town, phone), ordered by name.
   - A simple name search box (reuses `escapeLike`, same escaped-LIKE approach as `listApplications`).
   - An **"Add a donor"** form (name required → else `?error=name`; other fields optional).
   - A small admin-only **summary**: "This year (YYYY): N donations, $X.XX total" from
     `donationSummaryForYear(currentYear)`.
   - Donor **soft-delete** mirrors content/pickup exactly: delete redirects to
     `/admin/donors?undo=<id>`; the undo banner posts to `/admin/donors/[id]/restore.ts`.
   - Each donor row links to the donor page.

2. **Donor page** — `src/pages/admin/donors/[id].astro`.
   - An **"Edit donor"** form (all donor fields; name required).
   - That donor's **donation history** (non-deleted): date, amount, item description.
   - An **"Add a donation"** form: date (defaults to today, `YYYY-MM-DD`), amount (optional, via
     `parseMoney`), item description (optional). Require **date present AND (amount or item
     non-empty)** → else `?error=donation`.
   - Per-donation **soft-delete** with undo, handled inline on this page (no nested endpoint):
     delete redirects to `?undo_donation=<did>`; the undo button POSTs `act=restore_donation` with
     the donation id back to this page.
   - All mutations PRG-redirect with a banner flag; CSRF verified first.

### B. Contact messages — `src/pages/admin/messages/index.astro`
   - Lists messages newest first (`received_at DESC`): sender name, email, date, message text, and a
     read/unread marker. Unread rows visually distinguished.
   - **Mark read / Mark unread** button per row (toggles `read_at`; PRG redirect).
   - **Delete** per row: **hard delete** guarded by `data-confirm` ("Delete this message? This can't
     be undone.").
   - **Reply**: a plain `mailto:<email>?subject=...` link (opens her own email client).

### C. Data layer (`src/lib/db.ts`) — new helpers (all parameterized; reads filter `deleted_at IS NULL`)
- Donors: `AdminDonor` type; `listDonors(db, search)`, `getDonor(db, id)`, `createDonor(db, f)`
  (returns id), `updateDonor(db, id, f)`, `softDeleteDonor(db, id, iso)`, `restoreDonor(db, id)`.
- Donations: `AdminDonation` type; `listDonationsForDonor(db, donorId)`,
  `createDonation(db, donorId, {date, amount, itemDescription})` (returns id),
  `softDeleteDonation(db, id, donorId, iso)`, `restoreDonation(db, id, donorId)` (both scoped by
  `donor_id` so a crafted id can't touch another donor's donation),
  `donationSummaryForYear(db, year)` → `{ count: number; total: number }` (sum of non-null amounts
  for non-deleted donations of non-deleted donors, `substr(date,1,4) = year`).
- Messages: `AdminMessage` type; `listContactMessages(db)`, `setMessageRead(db, id, read: boolean, iso)`
  (sets `read_at` to iso or null), `deleteContactMessage(db, id)` (hard delete),
  `unreadMessageCount(db)` → number.

### D. Navigation
- `src/layouts/Admin.astro` `sections` array: add `{ href: '/admin/donors', label: 'Donors' }` and
  `{ href: '/admin/messages', label: 'Messages' }`.
- `src/components/admin/AdminHome.astro`: add two cards — **"Donations & donors"** and **"Messages"**
  (the Messages card shows the unread count when > 0, e.g. "3 unread"). AdminHome fetches the unread
  count itself via `unreadMessageCount(db)`, exactly as it already fetches `getSettings(db)` — no new
  prop threading through `admin/index.astro`.

## Files
- Modify: `src/lib/db.ts`, `src/layouts/Admin.astro`, `src/components/admin/AdminHome.astro`
  (AdminHome fetches the unread count itself — `admin/index.astro` is untouched).
- Create: `src/pages/admin/donors/index.astro`, `src/pages/admin/donors/[id].astro`,
  `src/pages/admin/donors/[id]/restore.ts`, `src/pages/admin/messages/index.astro`.
- Tests: `tests/db-donors.test.ts`, `tests/db-donations.test.ts`, `tests/db-messages.test.ts`.

## Testing (TDD per working agreements)
- Donors: create/list (search with `escapeLike`, incl. a literal `%`), update round-trip,
  soft-delete hides + restore brings back.
- Donations: create under a donor, list only that donor's non-deleted donations, soft-delete scoped
  by `donor_id` (wrong donor id is a no-op), restore; `donationSummaryForYear` counts/sums only the
  right year's non-deleted donations with non-null amounts.
- Messages: list newest-first, `setMessageRead` toggles `read_at` both ways, `unreadMessageCount`
  reflects unread rows, `deleteContactMessage` removes the row.
- Page behavior (CSRF gating, PRG redirects, banners) verified by the per-task reviews and a manual
  pass, consistent with Plans 3b/3c.

## Out of scope
No public donation total; no change to the public Donate page or PayPal; no email-from-app reply
(messages already arrive in her inbox; reply is a `mailto:` link).

## Acceptance criteria
1. From the admin home, the operator can open Donors, add a donor, open that donor, edit them, and
   record and remove donations — each with an obvious Back and a clear confirmation; deletes are
   undoable.
2. She can open Messages, read them, mark read/unread, reply via her email client, and delete a
   message (with a confirm).
3. The admin home shows an unread-message count when messages are unread.
4. `npm run test`, `npm run build`, and `npx tsc --noEmit` all pass.
