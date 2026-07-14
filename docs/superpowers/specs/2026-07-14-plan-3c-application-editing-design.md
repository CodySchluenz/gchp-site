# Plan 3c — Finish the Applications Surface (design)

**Date:** 2026-07-14
**Status:** approved (design); spec awaiting owner review before writing-plans
**Depends on:** Plans 1, 2, 3a, 3b (all merged to `main`)

## Goal
Bring post-submission editing of an application to full parity with the paper form (edit every
field, add/remove household members and employers), and clear the applications-workflow polish
items carried in `docs/decisions.md`. Donations, the donor directory, and the contact-messages
screen are explicitly **out of scope** — they become Plan 3d.

## Why
The applications surface is the operator's #1 daily task and the project's top acceptance
criterion (CLAUDE.md). Today she can edit only a subset of core fields
(`src/pages/admin/applications/[id]/edit.astro`); income/benefit amounts, employers, and
household members are read-only, and the edit form itself says member editing is "coming soon."
Families call in corrections after submitting (a newborn, someone who moved out, a changed
income), so to truly replace the paper process she must be able to maintain the whole record.

## Owner decisions that shaped this (2026-07-13/14)
- **Split the remaining admin work:** Plan 3c = editing + workflow polish; Plan 3d = donations +
  donor directory + contact messages.
- **Full-parity editing:** edit every field, and add/remove household members and employers.
- **Donations stay admin-only** (Plan 3d concern; noted here only to bound scope).
- **Member/job removal is a hard delete with a clear confirm**, not soft-delete-with-undo.
  Rationale: `household_members` and `employers` have no `deleted_at`; adding one would force a
  `WHERE deleted_at IS NULL` filter into every read path (confirmation email, detail, pickup
  slips, export) — real risk for a rare action. The whole application remains recoverable via its
  own existing undo, and removal is guarded by a confirm prompt.

## Global constraints (inherited — every task must honor)
- **CSP is `script-src 'self'`.** No inline event handlers, no inline `<script>`. All JS lives in
  external files; `public/scripts/print-button.js` already provides print + `data-confirm`.
- **Every mutating admin POST enforces CSRF** (double-submit HMAC via `src/lib/csrf.ts`). Auth
  gating is automatic via the URL-prefix middleware.
- **Operator usability:** admin base font ≥18px on every screen; text-labeled buttons (never
  icon-only); plain English; one clear primary action; obvious Back; confirm before destructive
  actions.
- **Straight apostrophes only** (`'`) in code-authored copy.
- **Sensitive PII:** never log names/addresses; never put PII in redirect query strings (ids and
  status words only); gated `/admin` routes only.
- **D1 limits:** ≤100 bound params per statement; no query fan-out that scales with row count.

## Architecture

### Editing approach — reuse the news/pickup editor pattern
The news and pickup editors built in Plan 3b (`/admin/content`, `/admin/pickup`) established a
proven, no-JS, CSP-safe pattern: a per-row `<form>` with Save/Remove, a separate "Add" form, and
server round-trips that redirect with a banner. Plan 3c reuses it. One clear purpose per screen.

**The application detail page** (`src/pages/admin/applications/[id].astro`) gains three plain
buttons linking to the editors: "Edit details", "Edit household members", "Edit jobs".

1. **Edit details** — extend the existing `src/pages/admin/applications/[id]/edit.astro`
   (single form, one Save) to cover **all** application-row fields, adding to today's set:
   - `full_time_residence_confirmed` (checkbox), `no_employment_confirmed` (checkbox)
   - income/benefit amounts + "for whom" text: `food_share_amount`; `social_security_amount` /
     `social_security_for`; `ssi_amount` / `ssi_for`; `child_support_amount` /
     `child_support_for`; `unemployment_weekly_amount` / `unemployment_for`;
     `other_income_amount` / `other_income_for`
   - `good_deed` (textarea), `may_not_be_eligible` (checkbox)
   Amounts parse with the existing `parseMoney` (blank or a number; garbage → gentle banner, not
   saved). `permanently_disabled`, `diabetic`, bed, household type, years, adopted — already present.

2. **Edit household members** — new `src/pages/admin/applications/[id]/members.astro`.
   Each member is a row-form: name, relationship, sex, age, pants, shirt_top, underwear, socks,
   diapers, gifts + Save. An "Add a person" form appends at the next `position` (cap `MAX_MEMBERS`
   = 15). A per-row "Remove" button hard-deletes (confirm via `data-confirm`), then positions are
   renumbered 1..n.

3. **Edit jobs (employers)** — new `src/pages/admin/applications/[id]/employers.astro`.
   Each employer is a row-form: employer_name, worker_name, hourly_wage, hours_per_week + Save.
   An "Add a job" form appends (cap `MAX_EMPLOYERS` = 10). A per-row "Remove" hard-deletes
   (confirm). Employers have no position column; order by `id`.

Rejected alternatives: (B) one giant single-form edit of the whole application — overwhelming for
the operator, and add/remove without JS is awkward inside one form. (C) inline editing on the
detail page — clutters the read/print view.

### Data layer (`src/lib/db.ts`) — new/changed helpers
All parameterized. Every child delete/update verifies the child belongs to the target application
(`WHERE id = ? AND application_id = ?`) so a crafted id cannot touch another record.

- `ApplicationFullEdit` type + `updateApplicationFull(db, id, f)` — **replaces**
  `updateApplicationCore` (remove the old type + function and update its sole caller,
  `edit.astro`, to avoid dead code), setting today's core fields plus the
  income/confirmation/eligibility fields above in one single-statement UPDATE.
- Members: `insertMember(db, applicationId, m)` (position = current max+1),
  `updateMember(db, id, applicationId, m)`, `deleteMember(db, id, applicationId)` then
  `renumberMembers(db, applicationId)` (1..n by position, batch).
- Employers: `insertEmployer(db, applicationId, e)`, `updateEmployer(db, id, applicationId, e)`,
  `deleteEmployer(db, id, applicationId)`.

### Workflow polish (from `docs/decisions.md` "Plan 3c binding notes")
- **PRG on approve/deny** (`[id].astro` POST): redirect 303 to `/admin/applications/{id}?done=approved`
  or `?done=denied`; render a banner. Prevents a refresh re-sending the applicant email.
- **PRG on news/pickup add/save/move** (`/admin/content`, `/admin/pickup` POSTs): redirect with a
  `?saved=…` banner instead of re-rendering, so a refresh can't duplicate an "Add".
- **Undo/restore banner:** the three `restore.ts` endpoints redirect with `?restored=1`; the list
  pages render "It's back in your list."
- **CSRF-failure + validation feedback:** on a failed CSRF check or a rejected value, edit/members/
  employers/detail POSTs redirect back with a gentle `?error=…` banner ("That didn't save — please
  try again." / "Please type a number.") instead of silently discarding.
- **PU# assignment race:** rewrite `assignPuNumber` so the "assign next" path is a single UPDATE
  (e.g. `UPDATE … SET pu_number = (SELECT COALESCE(MAX(pu_number),0)+1 FROM applications WHERE
  season_year = ?) WHERE id = ? AND pu_number IS NULL` then read back), removing the read-then-write
  gap.
- **Name search LIKE escaping:** escape `%`, `_`, and the escape char in the search term in
  `listApplications` (append `ESCAPE '\'`), so a literal `%` in a surname doesn't wildcard.
- **Excel export columns:** extend `ExportRow` / `listApplicationsForExport` with discrete columns
  for `years_received_help`, `adopted_last_year`, `bed_choice`, `bed_size`, `member_count`, and two
  concatenated summary columns — `income_summary` (non-null benefit amounts as labeled text, e.g.
  "SSI $520; Child support $200") and `employment_summary` (per-employer "worker @ employer:
  $wage x hours"). One summary column each keeps the sheet readable rather than a dozen sparse
  numeric columns. Also make the list page's "Download for Excel" href honor the active `q` filter:
  thread `q` through to `listApplicationsForExport` (it already filters by season/status) and apply
  the same escaped LIKE name filter.
- **Paper PDF cache:** serve `/application.pdf` (`src/pages/application.pdf.ts`) with
  `Cache-Control: no-cache` (or `max-age=0, must-revalidate`) so a freshly uploaded PDF shows
  immediately rather than up to 5 minutes stale.

## Testing (TDD per working agreements)
Unit tests (Vitest, against the migrated test D1) for every new/changed db helper:
- `insertMember` assigns the next position; `updateMember` changes only the target row;
  `deleteMember` removes only the target and only when `application_id` matches; renumber yields 1..n.
- Same three for employers (order by id; delete gated by application_id).
- `updateApplicationFull` round-trips every new field including null amounts.
- `listApplicationsForExport` returns the new columns with correct values (incl. member count and
  benefit summary) for a seeded application.
- `listApplications` LIKE escaping: a surname containing `%`/`_` matches literally, not as a wildcard.
- `assignPuNumber` single-statement path still returns the next number and is idempotent when a
  number already exists.
Page/endpoint behavior (CSRF gating, redirects, banners) is verified by the per-task reviews and a
manual pass, consistent with how the Plan 3a/3b admin pages were handled.

## Files (anticipated)
- Modify: `src/lib/db.ts`, `src/pages/admin/applications/[id]/edit.astro`,
  `src/pages/admin/applications/[id].astro`, `src/pages/admin/applications/index.astro`,
  `src/pages/admin/applications/export.csv.ts`,
  `src/pages/admin/applications/[id]/restore.ts`,
  `src/pages/admin/content/index.astro`, `src/pages/admin/content/[id]/restore.ts`,
  `src/pages/admin/pickup/index.astro`, `src/pages/admin/pickup/[id]/restore.ts`,
  `src/pages/application.pdf.ts`
- Create: `src/pages/admin/applications/[id]/members.astro`,
  `src/pages/admin/applications/[id]/employers.astro`, and their tests.
- Tests: extend `tests/db-*.test.ts` (new files for members/employers as needed).

## Out of scope → Plan 3d
Donations recording, donor directory, contact-messages admin screen.

## Acceptance criteria
1. From an application's detail page, the operator can open three editors and, unaided, correct any
   field, add and remove household members and employers, and save — each with an obvious Back and a
   clear confirmation.
2. Removing a member or job shows a confirm prompt (a JS enhancement via `data-confirm`); with
   JavaScript off the confirm is skipped but the Remove POST still works and the page still renders.
3. Approving/denying, then refreshing, does not re-send the applicant email.
4. The Excel download reflects the active name filter and includes the added columns.
5. `npm run test`, `npm run build`, and `npx tsc --noEmit` all pass.
