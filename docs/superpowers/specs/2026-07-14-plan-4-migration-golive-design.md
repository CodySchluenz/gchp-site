# Plan 4 — Data Migration & Go-Live (design)

**Date:** 2026-07-14
**Status:** approved (design); spec awaiting owner review before writing-plans
**Depends on:** Plans 1, 2, 3a, 3b, 3c, 3d (all merged to `main`)

## Goal
Move the real donor directory and the current season's applications from the old MySQL dump into
Cloudflare D1, then cut over DNS to go live — keeping the old PHP site untouched until the new one is
verified. This is the final build plan.

## Two parts
- **A. Migration tooling** — an offline, dependency-free Node script (run once, by the technical
  owner) that reads the `.sql` dump and emits a reviewable `import.sql` loaded into production D1 with
  `wrangler d1 execute`. Built and TDD-tested now against synthetic rows shaped like the documented
  old schema.
- **B. Go-live runbook** — `docs/go-live-runbook.md`, an ordered checklist the owner executes. Written
  now; execution is blocked on the real dump, the production Cloudflare account, and DNS — none of
  which the agent has.

## Context that shaped this (from `docs/legacy-inventory.md`)
- The old site runs "DELETE ALL APPLICANTS" at season close, so the live DB holds only the **current
  season** (~258 applications, ~911 members, ~30 donors). **No historical archive exists.**
- `cities`, the news/gifts list (`content_blocks`), and the pickup schedule (`pickup_days`) are
  already carried into D1 as seed data (`migrations/0002_seed.sql`) and the operator now edits them
  through the admin — nothing to migrate there.
- Old `cityID` values map **1:1** to the seeded `cities.id` (the seed preserved the gap at id 21).
- Owner decisions: migrate **donors + current-season applications**; the export is a **full MySQL
  dump (.sql)**; **import all donors and flag likely-junk** for manual deletion (no auto-drop);
  **preserve the old `appID` as the new `applications.id`** (safe — the production table is empty at
  go-live — and it carries every parent/child link across exactly).

## Global constraints
- **No new dependencies.** Migration code is plain ESM `.mjs` run by `node`; tested by Vitest via a
  one-line `include` glob. It lives in `scripts/migrate/`, outside `src/`/`tests/`, so `tsc` and the
  app build are untouched.
- **Never carry secrets or real PII into the repo.** The dump and the generated `import.sql` are
  local-only working files — added to `.gitignore`, never committed. Tests use synthetic rows only.
- **The old PHP site stays live and untouched** until the new site is verified and DNS is cut over.
- **Straight apostrophes only** (`'`) in code-authored strings.
- SQL generation must escape single quotes (SQLite `''` doubling) so PII like `O'Brien` can't break
  or inject the generated file.

## Architecture — migration tooling (`scripts/migrate/`)

Pure, testable ESM modules + a thin CLI:

1. **`parse.mjs` — `parseColumns(sql, table)` + `parseRows(sql, table)`** → column names, then rows
   as **name→value objects**.
   `mysqldump` writes `INSERT INTO \`table\` VALUES (…)` **without** a column list (values in
   CREATE-TABLE order), and some old tables carry extra key columns the inventory notes
   (`appEmpID`, `benID`). So map by **name**, never by position: `parseColumns` reads the ordered
   column names from the `CREATE TABLE \`table\` ( … )` block; `parseRows` tokenizes each value tuple
   and zips it to those names, returning one object per row. The tokenizer handles single-quoted
   strings with SQL-escaped quotes (`''` and `\'`), commas inside quoted values, numbers, and `NULL`
   → JS `null`. (If a dump ever uses `--complete-insert` with an explicit column list, prefer that
   list over the CREATE-TABLE order.) Transforms then reference `row.fName`, `row.appID`, etc. — immune
   to extra or reordered columns.
2. **`transform-donors.mjs` — `transformDonors(rows)`** → `{ donors: DonorRow[], flagged: string[] }`.
   Maps old `donor` → new `donors`; imports all; adds a name to `flagged` when it looks like junk
   (heuristic: name shorter than 3 chars, OR no letters, OR all of contact/address/phone/email blank).
3. **`transform-applicants.mjs` — `transformApplicants({applicants, appEmp, benefits, children, goodDeed})`**
   → `{ applications, members, employers, flagged }`. Groups every table by `appID`, assembles one new
   `applications` row + its `household_members` + `employers`, applying the field map below.
4. **`sql.mjs` — `generateImportSql({donors, applications, members, employers})`** → a string of
   `INSERT` statements (donors first, then applications, then members, then employers). Escapes all
   strings; renders numbers/`null`/booleans (`1`/`0`) correctly.
5. **`run.mjs` — CLI:** `node scripts/migrate/run.mjs path/to/dump.sql` reads the dump, runs the
   transforms, writes `import.sql` next to it, and prints a **migration report** to stdout: counts
   (donors, applications, members, employers), the flagged-junk donor names, the appIDs that got a
   synthesized head member, and the appIDs whose `w2Amount` was folded into other income.

### Field mapping

**Donors** (`donor` → `donors`): `donName`→`name`, `donContact`→`contact_person`, `address`→`address`,
`city`→`city`, `state`→`state`, `zip`→`zip`, `phone`→`phone`, `email`→`email`. `donID` dropped (new
autoincrement id). `deleted_at` = NULL.

**Applications** (`applicants` + `benefits` + `goodDeed` → `applications`):

| new column | from | notes |
|---|---|---|
| `id` | `appID` | preserved explicitly |
| `first_name` / `last_name` | `fName` / `lName` | |
| `address` | `address` | |
| `city_id` | `cityID` | 1:1 to seeded cities |
| `phone` / `email` | `phone` / `email` | |
| `diabetic` | `diabetic` | 0/1 |
| `share_with_sponsor` | `tree` | the "permission to adopt" flag |
| `submitted_at` | `date` (`YYYY/M/D`) | parsed to ISO `YYYY-MM-DDT00:00:00Z`; unparseable → flag + `2025-01-01T00:00:00Z` fallback |
| `season_year` | year of `date` | fallback 2025 if unparseable |
| `status` | `approved` | `'1'`→`'approved'`, else `'new'` (old had no "denied") |
| `bed_choice` | `bedType` | `'sheet'`→`'sheets'`, `'blanket'`→`'blanket'`, else `'none'` |
| `bed_size` | `bedSize` | valid twin/full/queen/king else NULL; NULL when `bed_choice='none'` |
| `food_share_amount` | `fsAmount` | |
| `social_security_amount` | `socAmount` | `social_security_for` = `''` |
| `ssi_amount` | `ssiAmount` | `ssi_for` = `''` |
| `child_support_amount` | `csAmount` | `child_support_for` = `''` |
| `unemployment_weekly_amount` | — | NULL (old had none); `unemployment_for` = `''` |
| `other_income_amount` | `omAmount` (+ `w2Amount`) | if `w2Amount` > 0: `other_income_amount = (omAmount??0) + w2Amount` and `other_income_for = 'includes migrated W-2 wages'` + flag; else `omAmount`, `other_income_for = ''` |
| `good_deed` | `goodDeed.deedText` | `''` if none |
| `no_employment_confirmed` | derived | `1` if applicant has no non-blank employer, else `0` |
| `household_type` | default | `'family'` (old didn't distinguish) |
| `permanently_disabled` | default | `0` |
| `full_time_residence_confirmed` | default | `0` (a new-form attestation the old form never collected) |
| `years_received_help` | default | `0` |
| `adopted_last_year` | default | `0` |
| `may_not_be_eligible` | default | `0` |
| `pu_number` / `bags_count` | default | NULL (assigned in the new admin if needed) |
| `deleted_at` | default | NULL |

**Household members** (`children` → `household_members`, plus a synthesized head when needed):
`application_id` = `appID`; `position` = 1..n per appID ordered by `childID`; `name`←`name`,
`sex`←`sex`, `age`←`age`, `pants`←`pantSize`, `shirt_top`←`shirtSize`, `underwear`←`undSize`,
`socks`←`sockSize`, `diapers`←`diaperSize`, `gifts`←`gift`; `relationship` = `''` (old didn't
capture). **If an appID has zero `children` rows**, synthesize one member `{ name: "fName lName",
relationship: 'self', sex: '', age: 0, sizes '', gifts '' }` at position 1 and flag it — this
satisfies the orphan-protection (every application must have ≥1 member).

**Employers** (`appEmp` slots 1..4 → `employers`): for each slot where `employerN` is non-blank →
one row: `application_id` = `appID`, `employer_name` = `employerN`, `worker_name` = `"fName lName"`
(old captured no per-employer worker name — uniform default to the household head), `hourly_wage` =
`wageN ?? 0`, `hours_per_week` = `hrsPerWkN ?? 0`.

## Go-live runbook (`docs/go-live-runbook.md`) — outline the owner executes
An ordered checkbox checklist:
1. **Export** the old DB as a `.sql` dump (phpMyAdmin/cPanel).
2. **Provision production** Cloudflare: create the D1 database and R2 bucket; set secrets
   (`CSRF_SECRET` — a fresh 64-hex random; `RESEND_API_KEY`); confirm `admin_emails` seed is correct;
   apply `migrations/*.sql`.
3. **Import:** run `node scripts/migrate/run.mjs dump.sql`, review the migration report and the
   flagged rows, then load `import.sql` with `wrangler d1 execute <db> --file=import.sql --remote`.
4. **Deploy** to Cloudflare Pages from `main`; upload the paper-application PDF to R2.
5. **Verify on the Pages URL (before cutover):** row counts match the dump report; spot-check a few
   donors and applications in the admin; submit a real test application; complete an admin magic-link
   login; delete flagged-junk donors via the admin.
6. **DNS cutover:** point the domain at Pages — old site stays live as fallback.
7. **Post-cutover cleanup:** rotate the old admin + MySQL passwords; remove/redact the stale-login
   `gchpManual.pdf`; decommission the old site once the new one is confirmed stable.

The runbook uses placeholders for owner-specific values (domain, account/DB names) and never contains
secrets.

## Testing (TDD)
Vitest specs in `scripts/migrate/*.test.mjs` (added to the vitest `include` glob):
- **parse:** `parseColumns` reads names from `CREATE TABLE` (incl. a table with an extra key column);
  `parseRows` zips values to names; multi-row INSERT; a value with an escaped apostrophe (`O''Brien`);
  a comma inside a quoted address; `NULL` → `null`; ignores other tables.
- **donors:** field map; junk heuristic flags gibberish/short/contactless rows but keeps real ones.
- **applicants:** full field map incl. `tree`→`share_with_sponsor`, `approved`→`status`,
  bed mapping, date→ISO + season_year, `no_employment_confirmed` derivation, `w2Amount` fold + flag,
  the synthesized-head member for a childless applicant, employer slot expansion (blank slots skipped,
  worker defaults to head).
- **sql:** escapes `'` (`O'Brien` → `O''Brien`); renders NULL and numbers unquoted; emits donors →
  applications → members → employers order; preserves `appID` as `applications.id`.
- **end-to-end:** a `.test.mjs` that feeds a small synthetic dump through parse → transform → sql,
  loads the generated `import.sql` into a fresh local D1 (via `getTestDb` + statement execution), and
  asserts the row counts and a spot-checked application (preserved id, its members and employers)
  round-trip correctly. Proves the generated SQL actually loads and satisfies the schema's FKs and
  NOT-NULL/CHECK constraints.

## Out of scope
No changes to the running app (public site or admin); no historical/multi-season import (none exists);
`cities`/`content_blocks`/`pickup_days` already seeded. The actual export, provisioning, import
execution, deploy, and DNS cutover are owner steps in the runbook, not agent actions.

## Acceptance criteria
1. `node scripts/migrate/run.mjs <dump>` produces a valid `import.sql` and a clear report from a
   representative synthetic dump; loading it into a fresh local D1 yields applications (with preserved
   ids), members, employers, and donors that match the input.
2. Every transform/parse/sql function is covered by passing Vitest specs, including the escaping,
   orphan-member, and junk-flag edge cases.
3. `import.sql` and any `*.sql` dump are git-ignored; no PII or secret is committed.
4. `docs/go-live-runbook.md` is complete, ordered, and self-contained for a technical owner.
5. `npm run test`, `npm run build`, and `npx tsc --noEmit` all pass (the app is unchanged).
