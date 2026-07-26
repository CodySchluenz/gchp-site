# Doll Terminology Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sherlyn's terminology (2026-07-25): the doll choice is **White doll / Non-White doll** (plus No doll), replacing Black doll / White doll everywhere.

**Architecture/Decisions:** Rename the stored canonical value `'black'` → `'non_white'` (not a label-only change — stored values and labels must agree for the next maintainer), with data migration `0013` converting any existing rows. Dropdown order per Sherlyn's phrasing: No doll / White doll / Non-White doll. Display label everywhere: `Non-White doll`; export member_summary marker: `, non-white doll`.

**Tech Stack:** Astro 5 + Cloudflare D1 + Vitest. `npm run test`, `npx tsc --noEmit`, `npm run build`.

## Global Constraints

- New canonical values: `''` | `'white'` | `'non_white'`. The applicant-facing select coerces anything else to `''` silently (never errors) — behavior unchanged, set updated.
- Every surface must agree — the complete inventory (verified by grep 2026-07-25):
  src: `MemberCard.astro`, `db.ts` (export SQL CASE ×2), `history.ts` (dollLabel), `validation/application.ts` (MemberClean type + coercion), `validation/application-admin.ts` (coercion), `members.astro` (both rows), `original.astro` (dollWord), `[id].astro` (People table cell).
  tests: `application-admin-validation`, `application-validation-household`, `db-admin-export`, `db-members`, `export-columns`, `history`.
- Straight apostrophes. Migration is data-only and idempotent; standard migrate-first deploy.

---

### Task 1: The rename, end to end

**Files:** Create `migrations/0013_doll_non_white.sql`; modify the 8 src files and 6 test files above; append 0013 to `tests/helpers/d1.ts`.

- [ ] **Step 1: Migration**

`migrations/0013_doll_non_white.sql`:

```sql
-- Terminology update (owner request 2026-07-25): the doll choice is
-- White / Non-White. Renames the stored value; idempotent; data-only.
UPDATE household_members SET doll = 'non_white' WHERE doll = 'black';
```

Append `'migrations/0013_doll_non_white.sql'` to the harness list in `tests/helpers/d1.ts`.

- [ ] **Step 2: Update the tests FIRST (red)** — in the 6 test files, replace every `'black'` doll value with `'non_white'`, every `Black doll` expectation with `Non-White doll`, and `', black doll'`/`'black doll'` member-summary expectations with `', non-white doll'`/`'non-white doll'`. Run `npx vitest run tests/history.test.ts tests/export-columns.test.ts tests/db-members.test.ts tests/db-admin-export.test.ts tests/application-validation-household.test.ts tests/application-admin-validation.test.ts` — expect FAIL against current code.

- [ ] **Step 3: Update src (green)** — apply the rename in all 8 src files:
  - `validation/application.ts`: `doll?: '' | 'white' | 'non_white';` and coercion `(dollRaw === 'white' || dollRaw === 'non_white' ? dollRaw : '')`.
  - `validation/application-admin.ts`: same coercion + cast.
  - `MemberCard.astro` options (order per Sherlyn): `<option value="">No doll` / `<option value="white">White doll` / `<option value="non_white">Non-White doll` (with the existing selected= pattern).
  - `members.astro`: both rows, same three options/order.
  - `db.ts` export SQL: marker CASE → `WHEN m.doll = 'white' THEN ', white doll' WHEN m.doll = 'non_white' THEN ', non-white doll'`; dolls_summary CASE → `WHEN 'white' THEN 'White doll (' || m.name || ')' WHEN 'non_white' THEN 'Non-White doll (' || m.name || ')'`.
  - `history.ts` dollLabel: `d === 'white' ? 'White doll' : d === 'non_white' ? 'Non-White doll' : 'No doll'`.
  - `original.astro` dollWord and `[id].astro` People cell: same white/non_white mapping (fallback unchanged).
  Run the Step 2 suite — PASS. Then full `npm run test`, `npx tsc --noEmit`, `npm run build`.

- [ ] **Step 4: Sweep** — `grep -rn "'black'\|Black doll\|black doll" src/ tests/` must return NOTHING. Commit:

```bash
git add -A
git commit -m "feat(dolls)!: terminology is White / Non-White — stored value renamed with data migration 0013"
```

## After the task (controller)

Deploy migrate-first (0013 before code — window harmless, applications closed); update the guide/manual artifacts' doll mentions; memory.
