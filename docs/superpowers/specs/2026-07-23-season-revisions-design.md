# Season Revisions — Sherlyn's Feedback Round (Remove Eligibility, Packing Slips, Dolls, Card Tracking, Her Spreadsheet)

Date: 2026-07-23. Status: approved by owner in brainstorming (five AskUserQuestion
decisions recorded below). Supersedes the income-check feature
(`2026-07-18-income-check-design.md`) — Sherlyn tried it and wants **all**
automated eligibility checking removed; she verifies by hand.

## Sherlyn's requests, verbatim intent

1. No income or other eligibility check — she does it all by hand now.
2. No print box cards feature.
3. "Pickup slips" → **"Packing slips"**, used by volunteers; remove **bags**
   and **gifts** from them.
4. Volunteers must never see applicants' income status or good deeds.
5. Application form gains a choice between **black and white dolls**.
6. Slips large, **3 per printed page** (matches her old site).
7. The Excel download is exactly her working sheet:
   `tNo | 2026 Applicant | Address | Special Gift | adopted | Thanksgiving |
   Food Card/Cert. | Amount | Gift Cards | GC Amount | NO. in HH`.
8. Thanksgiving card goes to the **first 30 applicants** each season; she
   tracks it by hand today — give her a checkbox or similar.

## Owner decisions (brainstorming, 2026-07-23)

1. **Removal depth:** full sweep — income-check feature AND the older
   automatic `mayNotBeEligible` "Check eligibility" flag; migration drops the
   `income_limits` table. The income *questions* stay on the form (she needs
   reported income for her hand-check) and the one-line "please list all
   income" nudge stays (it targets her exact forgotten-income complaint;
   trivially removable if she objects). `suggestHouseholdType` stays — it
   routes elderly/disabled to the mailed 2500 block (workflow, not eligibility).
2. **Excel:** her 11 columns REPLACE "Download list for Excel"; a second,
   less prominent **"Download everything (backup)"** keeps the full-detail
   export (succession + before-purge safety net).
3. **Card tracking:** admin-entered fields on the application detail page,
   flowing to the export; the website is the record.
4. **Thanksgiving:** manual checkbox per application + a running
   "Thanksgiving cards: X of 30 given" line on the applications list. No
   auto-marking (paper entries and deletes make "first 30" ambiguous).
5. **Doll choice:** per-child dropdown in each child's member row.
6. **Packing slip contents:** keep phone, DIABETIC, bed, sizes table; remove
   bags, the gifts column, and the "sponsor OK" flag (approved mockup).

## Non-negotiables carried forward

- Applicant form: JS-optional, warm copy, nothing wiped on errors, no new
  required fields. Admin: ≥18px, plain English, CSRF on mutations, `no-store`.
- PII never on volunteer-facing prints: packing slips must never contain
  income (amounts or status), good deeds, parentage notes, or admin notes —
  **pinned by a source-scan test** on `SlipCard.astro` forbidding the tokens
  `bags_count`, `gifts`, `good_deed`, `admin_notes`, `parentage_note`, and
  income field names (same pattern as the 245-address repo-scan test).
- Never cut off data: an unusually large household may take more than ⅓ page
  rather than truncate its members.

## Part 1 — Removals

**Income check (entire feature):**
- `/admin/income-limits` screen + its AdminNav entry + admin-home card.
- "Income check" box on `[id].astro`; "Check income" badge on the list;
  "Income check" export column; `src/lib/income-check.ts`;
  `getIncomeLimits`/`saveIncomeLimits` and the `employment_yearly` aggregates
  in `db.ts` (remove the aggregates only if nothing else consumes them);
  all their tests.
**Old eligibility flag:**
- `mayNotBeEligible()` in `src/lib/eligibility.ts` and every surface: the
  "Check eligibility" export column, any detail-page hint, the
  `may_not_be_eligible` write in `insertApplication`/validation.
  `suggestHouseholdType` remains.
- The `applications.may_not_be_eligible` **column stays in the database**,
  inert (`NOT NULL DEFAULT 0`) — dropping it would break live-site writes in
  the migrate→deploy window. Documented in the 0011 migration comment.
**Box cards (entire feature):**
- `cards.astro`, `[id]/card.astro`, `src/lib/box-cards.ts`, the "Print box
  card(s)" buttons on the list and detail pages, tests.
**Stays:** the Bags field on the admin detail (she may still count bags);
it just never prints anywhere.

## Part 2 — Packing slips

- Label rename everywhere the operator sees it: buttons ("Print packing
  slips"), page titles, single-slip page. Route paths (`/slips`) are not
  operator-visible and stay, avoiding breakage.
- `SlipCard.astro`: remove the Bags value, the Gifts table column, and the
  "sponsor OK" span. Keep: PU #, People, name + phone, address + town,
  pickup date (data-driven, unchanged), DIABETIC flag, bed choice + size,
  member table Name/Sex/Age/Sizes.
- Layout: each slip `min-height: ~3.3in` with `break-inside: avoid`, base
  print type ≥16px (name/PU# larger), so **three typical slips fill a page**;
  remove the current `page-break-after: always`. Oversized households flow
  taller rather than clip.
- Mailed households remain excluded (existing behavior, unchanged).

## Part 3 — Doll choice (applicant form)

- Migration 0010: `household_members.doll TEXT NOT NULL DEFAULT ''`
  (values `''` | `'black'` | `'white'`; enum enforced in validation, both the
  strict applicant validator and the lenient admin one — blank → `''`).
- `/apply`: in each member row (and the cloned `#member-template`), a
  small labeled dropdown — label **"Doll?"**, options **No doll / Black
  doll / White doll** — always visible, optional, JS-free, near the gifts box.
- Surfaces: admin detail member table (e.g. "Black doll" chip/text), the
  members editor, and folded into "Special Gift" (Part 5).

## Part 4 — Card + Thanksgiving tracking (admin-entered)

- Migration 0010 adds to `applications`:
  `thanksgiving_card INTEGER NOT NULL DEFAULT 0`,
  `food_card INTEGER NOT NULL DEFAULT 0`, `food_card_amount REAL`,
  `gift_card INTEGER NOT NULL DEFAULT 0`, `gift_card_amount REAL`.
- `[id].astro` gains a **"Cards given"** section (own CSRF'd POST action,
  pattern of the notes form): "Thanksgiving card given" ☐; "Food card or
  certificate given" ☐ + "Amount $"; "Gift cards given" ☐ + "Amount $"; one
  Save button. Money parse is forgiving (reuse `parseMoney`; blank → null);
  errors never wipe entries.
- Applications list header area: **"Thanksgiving cards: {X} of 30 given"**
  — X = count of `thanksgiving_card = 1` for the shown season, excluding
  soft-deleted. The 30 is a named code constant (`THANKSGIVING_CARD_TOTAL`).

## Part 5 — Excel exports

**Primary — "Download list for Excel" (replaces current columns entirely):**

| Header (verbatim) | Value |
|---|---|
| `tNo` | `pu_number` |
| `{season} Applicant` (e.g. `2026 Applicant`) | `first_name last_name` |
| `Address` | `address, city_name` |
| `Special Gift` | per-person gift asks + doll entries, e.g. `Black doll (Sue); bike (Tim)` |
| `adopted` | `yes` / `''` |
| `Thanksgiving` | `yes` / `''` |
| `Food Card/Cert.` | `yes` / `''` |
| `Amount` | `food_card_amount` (blank when null) |
| `Gift Cards` | `yes` / `''` |
| `GC Amount` | `gift_card_amount` (blank when null) |
| `NO. in HH` | `member_count` |

(Sherlyn's list said "Appicant" — using the correct spelling "Applicant".)
Same season/status/search/town filters as today.

**Backup — "Download everything (backup)"** (second, smaller button):
today's full column set minus `Check eligibility` and `Income check`, plus
`Thanksgiving`, `Food card`, `Food card amount`, `Gift cards`,
`Gift card amount`; the People summary gains doll markers (like the existing
disabled/part-time markers). Implemented as a second endpoint beside
`export.xlsx.ts`; filename e.g. `applications-full-{season}.xlsx`.

## Part 6 — Migrations & deploy order

- **`0010_dolls_and_cards.sql` (additive):** the six ADD COLUMNs above.
- **`0011_drop_income_limits.sql` (destructive):** `DROP TABLE income_limits;`
  plus a comment: `may_not_be_eligible` deliberately left inert (see Part 1).
- Test harness applies all schema migrations in order (0001, 0003, 0004,
  0005, 0008, 0009, 0010, 0011 — mirroring production exactly, including
  creating then dropping `income_limits`).
- **Live deploy (runbook section update):** run
  `npm run db:migrate:remote` (applies pending 0009 + 0010 + 0011) and
  `npm run build` + `npx wrangler pages deploy dist --project-name gchp-site`
  **back-to-back in one sitting**. Between the two commands the live admin
  applications screens will error (the old code still reads `income_limits`)
  — that window is minutes, applications are closed, and the runbook says so
  in bold. Do not stop halfway.

## Part 7 — Testing

- Validation: doll enum accepted/rejected, blank → `''`, both validators.
- DB round-trips: doll on member insert/update; cards-given save/read;
  Thanksgiving count (season-scoped, ignores soft-deleted).
- Export: exact-match test on the 11 primary headers + a row's values
  (including doll folding and blank-when-null amounts); backup export keeps
  full set minus the two removed columns.
- Slip privacy: source-scan test on `SlipCard.astro` (forbidden tokens above).
- Removal completeness: a grep over `src/`, `tests/`, and `public/` asserts
  no references to `income-check`, `income_limits`, `mayNotBeEligible`, or
  `box-cards` remain (migrations/ and docs/ legitimately keep the names).
- Build green; existing 258-test suite adjusted (income-check and box-card
  tests deleted with their features).

## Part 8 — After implementation

- Operator guide + succession manual (see memory `gchp-documents`): packing
  slip rename, Cards given box, Thanksgiving counter, the two-button Excel
  download, and the removals. Do this in the same batch, before deploy.

## Out of scope

- Any automated eligibility logic, ever (explicitly reversed by Sherlyn).
- Auto-marking the first 30 Thanksgiving applications.
- Route renames for slips (labels only).
- Removing the income questions or the report-all-income nudge from /apply.
- Dropping the `may_not_be_eligible` column (inert by design).
