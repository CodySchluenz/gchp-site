# Paper-Application Entry (Admin) — Design

Date: 2026-07-18. Status: approved by owner in brainstorming.

## Why

Sherlyn runs paper applications alongside the website as two separate systems.
The owner's decision (2026-07-18): the website becomes the official record —
she types paper applications in. The public Apply form cannot serve this
(considered and rejected): it blocks incomplete applications (her MAIN paper
case — the paper form itself says incomplete apps get a denial notice, and a
denial needs a record), it emails the family "we received your application,"
its rate limiter trips on a stack of entries, it is closed exactly when
stragglers arrive, and it stamps the wrong submission time with no
paper-source marker and no PU# field (page 2 of the paper form often has the
number pre-written).

So: not a second form — an **admin door into the form that already exists**.

OCR prefill stays parked (handwriting accuracy, PII-to-AI privacy, and
complexity vs. this project's boring-and-reliable rule); this entry form is
the foundation OCR would pre-fill anyway if ever revisited.

## Owner decisions (2026-07-18)

- Reuse, don't rebuild: the admin page reuses the Apply form's leaf components
  (`MemberCard`, `EmployerRow`, `BenefitRow`) and the validation layer's field
  parsers. **`src/pages/apply.astro` is not modified at all.**
- Lenient validation: only first/last name + town required; anything else may
  be blank (incomplete paper apps must be recordable). Malformed values (a
  wage of "abc") still get kind field errors; blank is never an error.
- No email is ever sent on entry. Approval/denial emails later work as normal
  (she can always use the "without email" buttons).
- Paper-only oddities (Do you have a car, doll white/non-white, Box #) get NO
  schema; her private Notes textarea sits on the entry form for them.

## Architecture

### Migration `0007_source.sql`

```sql
ALTER TABLE applications ADD COLUMN source TEXT NOT NULL DEFAULT '';
```

Default `''` means "recorded before source tracking" — the 238 imported legacy
rows stay honest (blank in the export) instead of being falsely labeled.
Going forward `insertApplication` gains an optional `source` parameter
defaulting to `'online'` (so the public Apply path stamps `'online'` without
`apply.astro` changing at all); the admin entry passes `'paper'`. Harness
applies `0007`.

### Lenient validation — `validateApplicationAdmin` (validation layer)

Lives beside `validateApplication`, reusing the same field parsers and member/
employer/benefit sub-parsers. Differences from the strict path:

- Required: `first_name`, `last_name`, valid `city_id`. Nothing else.
- Blank anything → accepted as empty/null; malformed numbers → the same kind
  errors as the public form; errors re-render with values preserved (never
  wipe her typing).
- No residence-confirmation, good-deed, or no-employment-vs-jobs cross-checks.
- Household type: explicit radio on the admin form (paper page 2's
  Elderly/Disabled vs Family checkbox), defaulting to 'family'; the derived
  suggestion is not used to override her choice.
- Derived flags (`may_not_be_eligible`, permanently-disabled from members)
  compute exactly as the strict path does from whatever was entered.
- Members with every field blank are skipped (like the public form's blank
  rows); zero members is allowed (incomplete paper).

### Route — `src/pages/admin/applications/new.astro`

Admin-only (middleware), CSRF on POST, no rate limit, independent of the
applications-open toggle, sends no email. Renders the Apply field set in the
same order with admin copy ("Leave anything blank that is blank on the
paper."), plus, at the top:

- **Date received** — `<input type="date">`, defaults to today (Central).
  Stored as `submitted_at = 'YYYY-MM-DDT12:00:00Z'` (noon UTC is the same
  calendar day in Central year-round, so the new Central-time displays can
  never day-shift it).
- **Type of household** — radio: Family / Elderly / Disabled (default Family).
- **Pickup number (optional)** — if the paper already has one.
- **Your notes (only you see this)** — the existing admin-notes semantics,
  saved with the application (car/doll/Box # live here).

JS-free "+ Add another person/job" round-trips exactly like Apply's (same
`action=add_member/add_employer` re-render pattern, values preserved).

Save flow: `insertApplication` with lenient-parsed values, `source='paper'`,
season = year of the received date; then `setApplicationNotes` if notes were
typed; then, if a PU# was typed, `setPuNumber` — on a duplicate, the
application is STILL saved and the redirect carries the existing
`error=pu_taken&by=N` flag so the detail page shows the standard message with
the number box right there. Success redirect: the new application's detail
page with a "Paper application entered." banner.

### Surfaces

- Applications list: an "Enter a paper application" button near the download
  button → `/admin/applications/new`. (Distinct from the "Paper application"
  nav item, which is the PDF-upload screen — copy must not confuse the two.)
- Detail page: a quiet "Entered from paper" line (only when `source='paper'`).
- Excel export: a "Source" column (`paper` / `online`) at the end of the
  header row.

## Testing

- `validateApplicationAdmin` TDD: minimal input (name + town) passes with
  defaults; blank everything-else passes; malformed wage/amount/age still
  error on the right field; full strict-form input parses identically to
  `validateApplication`'s output; blank member rows skipped; zero members OK.
- D1: insert via the lenient path → `source='paper'`, chosen `submitted_at`,
  notes saved; PU set when free; duplicate PU → application exists, number
  null, clash reported.
- Export: "Source" header + values.
- Page: `npm run build` + suite green (house pattern).

## Out of scope

- Any modification to `src/pages/apply.astro` or the strict validation path.
- Schema for car / doll preference / Box # (notes cover them).
- OCR prefill (parked).
- Bulk import; editing `source` after creation.
