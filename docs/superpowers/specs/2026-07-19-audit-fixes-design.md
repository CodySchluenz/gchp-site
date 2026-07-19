# Audit Fixes — Design

Date: 2026-07-19. Status: owner ordered "fix all of these issues" after the
four-lens audit (correctness/security, UI consistency, WCAG 2.2 AA,
CLAUDE.md non-negotiables) at HEAD 4e13502. This spec records what each fix
IS, so the changes are deliberate rather than ad-hoc.

## A. Error banners rendered as success (9 admin screens) — the big one

Every admin page that folds failure messages into its green `banner` variable
splits it: banners become `{ text, isError }` (or equivalent), rendering:

- success/status → existing `border-l-4 border-holly-700 bg-white` +
  `role="status"` + `text-holly-800` (unchanged);
- errors → `border-l-4 border-berry-700 bg-white` + `role="alert"` +
  `text-berry-800` (the idiom applications/index.astro:78 already uses).

Affected (from the audit, exact error strings enumerated there): content,
donors index, donors [id], pickup, messages, income-limits, applications [id]
(pu_bad / pu_taken / csrf), [id]/employers, [id]/members. Also:

- `admin/verify.astro` failure box gains `role="alert"` (it has none).
- `[id].astro` "Please check eligibility" gold box gains `role="status"`.
- `contact.astro`'s validation-error summary adopts Apply's escalated
  treatment (`rounded-lg border-2 border-berry-700 bg-berry-100 p-5`, bold
  `text-xl` heading, `font-semibold text-berry-800 underline` links) — same
  audience, same purpose, same weight.

## B. Household-member / job removal joins the soft-delete + Undo pattern

Migration `0009_soft_delete_members.sql`: nullable `deleted_at TEXT` on
`household_members` AND `employers`. `deleteMember`/`deleteEmployer` become
soft deletes; new `restoreMember`/`restoreEmployer` + restore endpoints +
Undo banners on the members/employers screens, exactly like donors/pickup.
Every reader filters `deleted_at IS NULL`: getApplicationDetail (members +
employers), listApprovedForSlips members subquery, listApplications
member_count/employment_yearly subqueries, export member_count/
member_summary/gifts_summary/employment_yearly/employment_summary,
members/employers admin lists. `addMember` position MAX may keep counting
deleted rows (position collisions are harmless; number-block invariants are
unaffected — pu numbers live on applications). `data-confirm` also moves to
the FORM level on these two Remove buttons (fixes the SubmitEvent.submitter
fallback gap on old Safari). With Undo in place, the JS-off no-dialog case
becomes exactly as safe as every other delete in the app.

Messages join too: `0009` adds `deleted_at` to `contact_messages`;
`deleteContactMessage` becomes soft; restore endpoint + Undo banner; unread
counts and lists filter deleted. The "This can't be undone" confirm copy
changes to the standard "You'll see an Undo button right after."

## C. Season correctness

- Applications list (and the print/export routes' fallback): season defaults
  to `Number(param) || latestSeasonWithApplications || currentYear`, and the
  year dropdown always includes the selected season. On Jan 1 the operator
  still lands on the season she's wrapping.
- Online `apply.astro` stamps `seasonYear` from the CENTRAL calendar year
  (same `Intl en-CA / America/Chicago` derivation the paper-entry page uses)
  — closes the Dec-31-evening wrong-season window and unifies online/paper.
- DELIBERATE NON-FIX: `/admin/income-limits` keeps the calendar-year
  default. Her January ritual updates the NEW year's chart for the upcoming
  season — calendar year is the correct target there. Documented so nobody
  "fixes" it later.

## D. The small pile (each deliberate)

1. Seed migration `0002_seed.sql` text corrected 235 → 245 W. Elm. Editing
   an APPLIED migration is safe here and intended: wrangler tracks by
   filename, production never re-runs it — the edit only affects FRESH
   databases (disaster recovery, local dev), which is exactly the bug. Plus
   a repo test asserting the string "235 W. Elm" appears nowhere in
   `migrations/` or `src/`.
2. "Delete this application" button adopts the outline-destructive idiom
   (`border-2 border-berry-700 text-berry-800 hover:bg-berry-100`).
3. `AdminNav` marks the current section: `aria-current="page"` when the
   current path matches the entry (exact match for `/admin`, prefix match
   for the rest) + `aria-[current=page]:bg-holly-900` styling, mirroring the
   public nav.
4. Both `admin_notes` textareas get wrapped in real labels.
5. `[id].astro` People table + `SlipCard` table gain `scope="col"` and an
   `sr-only` caption.
6. `AdminHome` gains the skip link from `Admin.astro`; the signed-out
   `/admin` page and `verify.astro` get it too (cheap while there).
7. Sign-out: both sign-out forms carry `csrf_token`; `signout.ts` verifies
   (on failure just redirect without clearing — never strand her).
8. Middleware adds `Strict-Transport-Security: max-age=31536000;
   includeSubDomains` on every response.
9. Public pickup table wrapped in `overflow-x-auto`.
10. The four print pages' Back links + Print buttons get minimal local
    hover/focus styles (they intentionally don't import global.css).
11. Donor list name-links adopt the applications-list idiom
    (`font-semibold text-berry-700 underline`).
12. Global link hover feedback: one rule in global.css —
    `a:hover { text-decoration-thickness: 2px; } a { text-underline-offset: 2px; }`
    — subtle, universal, no per-file churn.
13. Unique titles: verify.astro → "Sign-in link — GCHP Admin"; single
    slip/card pages → "Pickup slip — {First Last}" / "Box card — {First
    Last}" (admin-only surfaces; names in titles acceptable).
14. `scripts/migrate/run.mjs` prints flagged-donor NAMES only when
    `MIGRATE_SHOW_NAMES=1`; default prints the count and a pointer.
15. Magic-link origin hardening: allowlist the production domain,
    `*.pages.dev`, and localhost; anything else falls back to the production
    domain. No env var, no operational change.

## Out of scope (explicitly declined again)

- Excel-native date cells; print-history tracking; palette hue respacing;
  radio aria-invalid tinting (all previously accepted).
- Any change to which households get slips/cards, numbering, or validation.

## Testing

Soft-delete round-trips (member/employer/message: delete → hidden from every
reader incl. export aggregates → restore → visible); season default (empty
new year falls back to latest season with data); Central season-year
derivation; the 235-address repo scan; existing suites stay green. Banner
and markup changes verified by build + the audit's file:line list re-checked
in review.
