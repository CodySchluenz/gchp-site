# Season Summary + Duplicate Nudge — Design

Date: 2026-07-25. Status: approved by owner in brainstorming. Same batch records
the owner's NO-PURGE decision (below).

## Why

1. **Season summary:** Sherlyn answers to the Board and a yearly county audit;
   today "how many families did we serve, by town, and what did we give out"
   means hand-counting a spreadsheet. Every number already lives in D1.
2. **Duplicate nudge:** families sometimes apply twice (online + a paper copy,
   or a resubmission). She catches these by eye today. Surfacing the factual
   match — same name and address — is clerical help; the decision stays hers.
3. **No purge (owner decision 2026-07-25):** the purge-prior-seasons capability
   promised in CLAUDE.md will NOT be built. Seasons are kept for the audit; any
   future clearing is a developer task on explicit request. CLAUDE.md and
   docs/decisions.md updated in this batch.

## Non-negotiables (inherited)

- Decision-support only: nothing blocks, auto-merges, or auto-deletes. The
  nudge wording is calm and factual ("may be", "worth comparing"), never
  accusatory — an applicant family must never be treated as a suspect.
- Nothing stored: both features compute at render time (fixing a typo'd
  address clears the nudge instantly; the summary is always current).
- Admin-only; ≥18px; plain English; print-friendly summary; straight
  apostrophes; soft-deleted rows excluded everywhere.

## Feature 1 — Season summary (`/admin/season-summary`)

New page, added to `AdminNav` ("Season summary") and an AdminHome card
("Season summary — the year's numbers, ready for the Board."). Read-only;
one **Print this page** button (house `print-button.js` pattern); a season
selector following the house convention (param → latestSeason → year).

Data (one `getSeasonSummary(db, seasonYear)` in `db.ts`, TDD):

| Block | Definition (all `deleted_at IS NULL AND season_year = ?`) |
|---|---|
| Applications received | total; split by `source`: `'online'` → "Applied online", `'paper'` → "Entered from paper", `''` → "Imported from the old website" (row hidden when 0) |
| Families served | `status = 'approved'` |
| Still to review / Denied | `status = 'new'` / `'denied'` |
| People in served households | COUNT of non-deleted `household_members` across approved applications |
| By town | approved, non-mailed, non-straggler counts per city, ordered by `block_base`; zero-count towns omitted |
| Stragglers row | approved AND `straggler = 1` AND not mailed |
| Elderly & disabled (mailed) row | approved AND `household_type IN ('elderly','disabled')` |
| Precedence | mailed first, then straggler, then town — each approved family counted in exactly one row; the three groups sum to "families served" |
| Thanksgiving cards | `thanksgiving_card = 1` count, shown as "X of 30" (THANKSGIVING_CARD_TOTAL) |
| Food cards / certificates | `food_card = 1`: count + `SUM(food_card_amount)` (nulls ignored in the sum) |
| Gift cards | `gift_card = 1`: count + `SUM(gift_card_amount)` |

Cards rows count all non-deleted applications in the season regardless of
status (she can hand a Thanksgiving card to a family later denied — the tally
is what was given, matching the list counter's semantics). Dollar totals render
as whole dollars with cents only when present.

Layout: stat lines in the admin's plain card style; the by-town table in
pickup-block order; a print stylesheet that drops nav/buttons. Footer line:
"Numbers computed live from the applications list — {season}."

## Feature 2 — Duplicate nudge

**Matcher** (pure, `src/lib/duplicates.ts`, TDD):
`duplicateKey(lastName, address)` → normalized key: lowercase, trim, collapse
internal whitespace runs to one space, join as `last|address`. **Blank guard:**
if either normalized part is empty, the key is `null` — blank-address paper
entries and blank names NEVER match each other.
`findDuplicateIds(rows: {id, last_name, address}[])` → `Set<number>` of ids
whose key (non-null) is shared by 2+ rows.

**List page:** rows already fetched for the season → `findDuplicateIds` →
badge on matching rows: gold, quiet, `May be a duplicate` (same visual weight
as the old "Check eligibility" badge slot — a nudge, not an alarm).

**Detail page:** one small query (`listPossibleDuplicates(db, id)` in db.ts):
same season, non-deleted, same normalized key (computed in SQL with
`lower(trim(...))` — internal-whitespace collapse is approximated by the pure
lib on the fetched candidates so SQL stays simple: fetch by
`lower(trim(last_name))` match, then filter with `duplicateKey` in TS),
excluding self. When any exist, a note card above the decision buttons:

> **This may be the same household as application #1604** (Jane Smith,
> 123 Oak St — applied Oct 3, online). Worth comparing before you decide.
> [See #1604]

One line per match; wording calm; links to the other application(s). If the
other is already approved with a pickup number, say so ("already approved,
pickup number 1604") — that's the case where a double-award would happen.

## Housekeeping (same batch)

- CLAUDE.md: the non-negotiable's purge clause replaced with the owner
  decision (download-for-Excel stays; no purge feature; seasons kept for the
  audit; future clearing = developer task on request).
- `docs/decisions.md`: dated entry for the no-purge decision.
- Ops manual §8 ("Clearing out very old seasons' records, if the board ever
  wants that") stays accurate as a developer-task mention — reword lightly to
  note records are deliberately kept for the audit. Manual + guide gain the
  Season summary (and the guide a one-line duplicate-nudge mention) at the
  post-deploy doc pass, both artifact and repo copies.

## Testing

- `getSeasonSummary`: fixtures across statuses/sources/towns/cards; precedence
  (a mailed straggler counts once, in mailed); zero-town omission; the three
  groups sum to served; sums ignore null amounts; season scoping; soft-delete
  exclusion.
- `duplicates.ts`: match, case/whitespace insensitivity, internal-space
  collapse, blank-name/blank-address never match, self-exclusion (detail
  helper), cross-season isolation, three-way groups.
- `listPossibleDuplicates`: D1 round-trip incl. soft-deleted exclusion and the
  approved-with-number annotation fields.
- Screens: build-verified per house pattern; summary print styles present.

## Out of scope

- Purge (decided against — permanently, unless the owner reopens it).
- Auto-merge/auto-delete of duplicates; fuzzy matching (Smith vs Smyth) —
  exact normalized match only, deliberately.
- Storing summary snapshots or duplicate flags.
