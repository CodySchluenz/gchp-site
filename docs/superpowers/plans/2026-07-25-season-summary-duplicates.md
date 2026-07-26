# Season Summary + Duplicate Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only, printable "Season summary" admin page (the Board's numbers), a computed duplicate-application nudge on the list and detail pages, and the recorded no-purge decision.

**Architecture:** Everything computes at render time — `getSeasonSummary` (several small readable queries) and `listPossibleDuplicates` in `db.ts`, a pure `src/lib/duplicates.ts` matcher, no schema changes, no migration. New page + nav/home entries; badge + note card on existing pages.

**Tech Stack:** Astro 5 + Cloudflare D1 + Vitest. `npm run test`, `npx tsc --noEmit`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-25-season-summary-duplicates-design.md`

## Global Constraints

- Decision-support only; calm factual wording ("May be a duplicate", "Worth comparing before you decide"); nothing stored, blocked, or auto-merged.
- All counts: `deleted_at IS NULL AND season_year = ?`. Town precedence: mailed (household_type IN ('elderly','disabled')) first, then straggler, then town — each approved family in exactly one group; groups sum to "families served".
- Cards tallies count all non-deleted season applications regardless of status; SUMs ignore NULL amounts.
- Blank guard: a blank (after normalize) last name OR address yields NO duplicate key — never matches.
- Admin ≥18px plain English; straight apostrophes; summary page printable via the house `print-button.js` pattern; season param convention `Number(param) || latestSeason || calendar year`.
- No migration; standard code-only deploy.

---

### Task 1: Data layer — `duplicates.ts` + `getSeasonSummary` + `listPossibleDuplicates` (TDD)

**Files:**
- Create: `src/lib/duplicates.ts`, `tests/duplicates.test.ts`, `tests/db-season-summary.test.ts`
- Modify: `src/lib/db.ts`

**Interfaces (produced — Tasks 2–3 depend on these exact names):**

```ts
// src/lib/duplicates.ts
export function duplicateKey(lastName: string, address: string): string | null;
export function findDuplicateIds(rows: { id: number; last_name: string; address: string }[]): Set<number>;

// src/lib/db.ts
export type SeasonSummary = {
  received: number; online: number; paper: number; imported: number;
  served: number; toReview: number; denied: number;
  peopleServed: number;
  towns: { name: string; count: number }[];
  stragglers: number; mailed: number;
  thanksgiving: number;
  foodCards: number; foodCardTotal: number;
  giftCards: number; giftCardTotal: number;
};
export async function getSeasonSummary(db: D1Database, seasonYear: number): Promise<SeasonSummary>;
export type DuplicateCandidate = {
  id: number; first_name: string; last_name: string; address: string;
  submitted_at: string; status: string; pu_number: number | null; source: string;
};
export async function listPossibleDuplicates(db: D1Database, id: number): Promise<DuplicateCandidate[]>;
```

- [ ] **Step 1: Failing pure-lib tests** — create `tests/duplicates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { duplicateKey, findDuplicateIds } from '../src/lib/duplicates';

describe('duplicateKey', () => {
  it('normalizes case and whitespace', () => {
    expect(duplicateKey(' Smith ', '123  Oak   St')).toBe('smith|123 oak st');
    expect(duplicateKey('SMITH', '123 Oak St')).toBe('smith|123 oak st');
  });
  it('blank name or address never keys', () => {
    expect(duplicateKey('', '123 Oak St')).toBeNull();
    expect(duplicateKey('Smith', '   ')).toBeNull();
  });
});

describe('findDuplicateIds', () => {
  const r = (id: number, last_name: string, address: string) => ({ id, last_name, address });
  it('flags every member of a matching group, including three-way', () => {
    const ids = findDuplicateIds([
      r(1, 'Smith', '123 Oak St'), r(2, 'smith ', ' 123  oak st'), r(3, 'Smith', '123 Oak St'),
      r(4, 'Jones', '5 Elm'), r(5, 'Jones', '9 Pine'),
    ]);
    expect([...ids].sort()).toEqual([1, 2, 3]);
  });
  it('blank rows never match each other', () => {
    expect(findDuplicateIds([r(1, 'TEST', ''), r(2, 'TEST', '')]).size).toBe(0);
  });
});
```

Run: `npx vitest run tests/duplicates.test.ts` — FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/duplicates.ts`:**

```ts
// The duplicate-application matcher: exact match on normalized last name +
// address, deliberately NOT fuzzy (Smith vs Smyth stays unmatched — a wrong
// nudge about a family costs trust). Computed at render time, never stored,
// so correcting a typo'd address clears the nudge immediately.
export function duplicateKey(lastName: string, address: string): string | null {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const l = norm(lastName);
  const a = norm(address);
  // Blank guard: paper entries may leave the address empty — two blanks are
  // not evidence of anything, so they never match.
  if (l === '' || a === '') return null;
  return `${l}|${a}`;
}

export function findDuplicateIds(rows: { id: number; last_name: string; address: string }[]): Set<number> {
  const byKey = new Map<string, number[]>();
  for (const row of rows) {
    const key = duplicateKey(row.last_name, row.address);
    if (key === null) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row.id);
  }
  const out = new Set<number>();
  for (const ids of byKey.values()) {
    if (ids.length > 1) for (const id of ids) out.add(id);
  }
  return out;
}
```

Run Step 1 tests: PASS.

- [ ] **Step 3: Failing D1 tests** — create `tests/db-season-summary.test.ts` (mirror `tests/db-cards-given.test.ts` harness + `base` fixture; use distinct seasons per `it` to avoid cross-test pollution). Cases to write (real assertions, one isolated db per test where fixtures differ):
  1. **Counts + sources:** insert 2 online (1 approved, 1 new), 1 paper (denied), and one row updated to `source = ''` via raw SQL (simulating imported) → `received 4, online 2, paper 1, imported 1, served 1, toReview 1, denied 2`... (make the arithmetic consistent — pick and pin exact fixtures).
  2. **peopleServed** counts members of approved apps only, excluding soft-deleted members (`softDeleteMember` one and assert the drop).
  3. **Town precedence:** approved family in Lancaster (city 13); approved straggler in Lancaster (`setStraggler`); approved elderly household (mailed) that is ALSO marked straggler → mailed row, not straggler row. Assert `towns` has Lancaster count 1, `stragglers` 1, `mailed` 1, and `towns` omits zero-count cities; `served === townsSum + stragglers + mailed`.
  4. **Cards:** `setCardsGiven` on an approved and on a denied app (Thanksgiving given to both, food card $50 on one, gift card $25 + one gift card with NULL amount) → `thanksgiving 2; foodCards 1, foodCardTotal 50; giftCards 2, giftCardTotal 25`.
  5. **Season scoping + soft-delete:** rows in another season and a soft-deleted app don't count anywhere.
  Also in this file: `listPossibleDuplicates` cases — same-season same-key match returns the other row's fields (incl. `pu_number` after approval); case/whitespace variants match; different season doesn't; blank addresses don't; self excluded; soft-deleted excluded.

Run — FAIL (functions missing).

- [ ] **Step 4: Implement in `src/lib/db.ts`** (near `listApplications`; import `duplicateKey` from `./duplicates`):

```ts
// The Board's numbers, computed live — several small readable queries beat
// one clever one. Precedence for the by-group table: mailed households first,
// then stragglers, then towns, so every served family lands in exactly one row.
export async function getSeasonSummary(db: D1Database, seasonYear: number): Promise<SeasonSummary> {
  const statusRows = await db
    .prepare(`SELECT status, source, COUNT(*) AS n FROM applications
              WHERE deleted_at IS NULL AND season_year = ? GROUP BY status, source`)
    .bind(seasonYear).all<{ status: string; source: string; n: number }>();
  let received = 0, online = 0, paper = 0, imported = 0, served = 0, toReview = 0, denied = 0;
  for (const r of statusRows.results) {
    received += r.n;
    if (r.source === 'online') online += r.n; else if (r.source === 'paper') paper += r.n; else imported += r.n;
    if (r.status === 'approved') served += r.n; else if (r.status === 'new') toReview += r.n; else if (r.status === 'denied') denied += r.n;
  }
  const people = await db
    .prepare(`SELECT COUNT(*) AS n FROM household_members m
              JOIN applications a ON a.id = m.application_id
              WHERE a.deleted_at IS NULL AND m.deleted_at IS NULL
                AND a.season_year = ? AND a.status = 'approved'`)
    .bind(seasonYear).first<{ n: number }>();
  const towns = await db
    .prepare(`SELECT c.name, COUNT(*) AS count FROM applications a JOIN cities c ON c.id = a.city_id
              WHERE a.deleted_at IS NULL AND a.season_year = ? AND a.status = 'approved'
                AND a.household_type NOT IN ('elderly', 'disabled') AND a.straggler = 0
              GROUP BY c.id ORDER BY c.block_base`)
    .bind(seasonYear).all<{ name: string; count: number }>();
  const groups = await db
    .prepare(`SELECT
                SUM(CASE WHEN household_type NOT IN ('elderly','disabled') AND straggler = 1 THEN 1 ELSE 0 END) AS stragglers,
                SUM(CASE WHEN household_type IN ('elderly','disabled') THEN 1 ELSE 0 END) AS mailed
              FROM applications WHERE deleted_at IS NULL AND season_year = ? AND status = 'approved'`)
    .bind(seasonYear).first<{ stragglers: number | null; mailed: number | null }>();
  const cards = await db
    .prepare(`SELECT
                SUM(thanksgiving_card) AS tg,
                SUM(food_card) AS fc, SUM(CASE WHEN food_card = 1 THEN COALESCE(food_card_amount, 0) ELSE 0 END) AS fct,
                SUM(gift_card) AS gc, SUM(CASE WHEN gift_card = 1 THEN COALESCE(gift_card_amount, 0) ELSE 0 END) AS gct
              FROM applications WHERE deleted_at IS NULL AND season_year = ?`)
    .bind(seasonYear).first<{ tg: number | null; fc: number | null; fct: number | null; gc: number | null; gct: number | null }>();
  return {
    received, online, paper, imported, served, toReview, denied,
    peopleServed: people?.n ?? 0,
    towns: towns.results,
    stragglers: groups?.stragglers ?? 0, mailed: groups?.mailed ?? 0,
    thanksgiving: cards?.tg ?? 0,
    foodCards: cards?.fc ?? 0, foodCardTotal: cards?.fct ?? 0,
    giftCards: cards?.gc ?? 0, giftCardTotal: cards?.gct ?? 0,
  };
}

// Possible duplicates of one application: same season, same normalized
// last name + address (the pure lib decides — SQL narrows by last name only
// so the whitespace-collapse rule lives in ONE place, duplicates.ts).
export async function listPossibleDuplicates(db: D1Database, id: number): Promise<DuplicateCandidate[]> {
  const self = await db
    .prepare('SELECT season_year, last_name, address FROM applications WHERE id = ? AND deleted_at IS NULL')
    .bind(id).first<{ season_year: number; last_name: string; address: string }>();
  if (!self) return [];
  const key = duplicateKey(self.last_name, self.address);
  if (key === null) return [];
  const { results } = await db
    .prepare(`SELECT id, first_name, last_name, address, submitted_at, status, pu_number, source
              FROM applications
              WHERE deleted_at IS NULL AND season_year = ? AND id != ?
                AND lower(trim(last_name)) = lower(trim(?))
              ORDER BY id`)
    .bind(self.season_year, id, self.last_name).all<DuplicateCandidate>();
  return results.filter((c) => duplicateKey(c.last_name, c.address) === key);
}
```

(+ the two exported types from Interfaces.) Run Step 3 tests: PASS. Full `npm run test`, `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): season summary numbers + possible-duplicate lookup, computed live (TDD)"
```

---

### Task 2: The Season summary page

**Files:**
- Create: `src/pages/admin/season-summary.astro`
- Modify: `src/components/admin/AdminNav.astro` (entry after 'Pickup schedule'), `src/components/admin/AdminHome.astro` (card after the Paper application card)

**Interfaces:** consumes Task 1's `getSeasonSummary`; `THANKSGIVING_CARD_TOTAL`, `listSeasons`, `latestSeason` from db.ts.

- [ ] **Step 1: The page** — create `src/pages/admin/season-summary.astro`:

```astro
---
import '../../styles/global.css';
import Admin from '../../layouts/Admin.astro';
import { getSeasonSummary, listSeasons, latestSeason, THANKSGIVING_CARD_TOTAL } from '../../lib/db';
export const prerender = false;

const db = Astro.locals.runtime.env.DB;
const url = new URL(Astro.request.url);
const season = Number(url.searchParams.get('season')) || (await latestSeason(db)) || new Date().getFullYear();
const s = await getSeasonSummary(db, season);
const seasons = await listSeasons(db);
const yearsToShow = seasons.includes(season) ? seasons : [...seasons, season].sort((a, b) => b - a);
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
---
<Admin title="Season summary" heading={`Season summary — ${season}`} back={{ href: '/admin', label: 'Back to admin home' }}>
  <p class="mt-1 text-lg text-stone-600">Help: the year's numbers, computed live from the applications list — ready to print for the Board.</p>

  <div class="mt-4 flex flex-wrap items-end gap-4 print:hidden">
    <form method="get" class="flex items-end gap-2">
      <label class="font-semibold">Season
        <select name="season" class="ml-2 rounded border-2 border-stone-400 p-2">
          {yearsToShow.map((y) => <option value={String(y)} selected={y === season}>{y}</option>)}
        </select>
      </label>
      <button type="submit" class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">Go</button>
    </form>
    <button type="button" data-print class="rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Print this page</button>
  </div>

  <div class="mt-6 grid gap-4 sm:grid-cols-2">
    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">Applications</h2>
      <p class="mt-2 text-lg">Received: <strong>{s.received}</strong>
        {s.imported > 0
          ? <span class="text-stone-600"> ({s.online} online · {s.paper} from paper · {s.imported} imported from the old website)</span>
          : <span class="text-stone-600"> ({s.online} online · {s.paper} from paper)</span>}
      </p>
      <p class="mt-1 text-lg">Families served (approved): <strong>{s.served}</strong></p>
      <p class="mt-1 text-lg">Still to review: <strong>{s.toReview}</strong> · Denied: <strong>{s.denied}</strong></p>
      <p class="mt-1 text-lg">People in served households: <strong>{s.peopleServed}</strong></p>
    </section>

    <section class="rounded-lg border-2 border-stone-300 bg-white p-5">
      <h2 class="text-2xl font-bold text-holly-800">Cards given</h2>
      <p class="mt-2 text-lg">Thanksgiving cards: <strong>{s.thanksgiving} of {THANKSGIVING_CARD_TOTAL}</strong></p>
      <p class="mt-1 text-lg">Food cards / certificates: <strong>{s.foodCards}</strong> · total <strong>{money(s.foodCardTotal)}</strong></p>
      <p class="mt-1 text-lg">Gift cards: <strong>{s.giftCards}</strong> · total <strong>{money(s.giftCardTotal)}</strong></p>
    </section>
  </div>

  <section class="mt-4 rounded-lg border-2 border-stone-300 bg-white p-5">
    <h2 class="text-2xl font-bold text-holly-800">Families served, by town</h2>
    {s.served === 0 ? (
      <p class="mt-2 text-lg">No approved applications yet this season.</p>
    ) : (
      <table class="mt-3 w-full max-w-md border-collapse text-left text-lg">
        <caption class="sr-only">Approved families per town</caption>
        <thead><tr><th scope="col" class="border-b-2 border-holly-700 p-2">Town</th><th scope="col" class="border-b-2 border-holly-700 p-2">Families</th></tr></thead>
        <tbody>
          {s.towns.map((t) => (
            <tr><td class="border-b border-stone-200 p-2">{t.name}</td><td class="border-b border-stone-200 p-2">{t.count}</td></tr>
          ))}
          {s.stragglers > 0 && <tr><td class="border-b border-stone-200 p-2 font-semibold">Stragglers</td><td class="border-b border-stone-200 p-2">{s.stragglers}</td></tr>}
          {s.mailed > 0 && <tr><td class="border-b border-stone-200 p-2 font-semibold">Elderly &amp; disabled (mailed)</td><td class="border-b border-stone-200 p-2">{s.mailed}</td></tr>}
          <tr><td class="p-2 font-bold">Total served</td><td class="p-2 font-bold">{s.served}</td></tr>
        </tbody>
      </table>
    )}
  </section>

  <p class="mt-4 text-stone-600">Numbers computed live from the applications list — {season}.</p>
  <script src="/scripts/print-button.js" defer></script>
</Admin>

<style>
  @media print {
    :global(header), :global(a[href="/admin"]) { display: none; }
  }
</style>
```

- [ ] **Step 2: Nav + Home entries.** `AdminNav.astro` sections array — insert after 'Pickup schedule': `{ href: '/admin/season-summary', label: 'Season summary' },`. `AdminHome.astro` — after the Paper application card add:

```astro
        <a href="/admin/season-summary" class="block rounded-lg border-2 border-holly-700 bg-white p-6 hover:bg-holly-100">
          <span class="text-2xl font-bold text-holly-800">Season summary</span>
          <span class="mt-1 block text-lg text-stone-700">The year's numbers, ready to print for the Board.</span>
        </a>
```

- [ ] **Step 3: Verify and commit** — `npm run build`, `npx tsc --noEmit`, full `npm run test`.

```bash
git add -A
git commit -m "feat(admin): Season summary page — the Board's numbers, live and printable"
```

---

### Task 3: Duplicate nudge UI + no-purge housekeeping

**Files:**
- Modify: `src/pages/admin/applications/index.astro` (badge), `src/pages/admin/applications/[id].astro` (note card), `CLAUDE.md`, `docs/decisions.md`

**Interfaces:** consumes `findDuplicateIds` (list) and `listPossibleDuplicates` (detail) from Task 1; `centralDate` from dates.ts.

- [ ] **Step 1: List badge.** In `index.astro`: import `findDuplicateIds` from `../../../lib/duplicates`; after `const rows = await listApplications(...)` add `const dupIds = findDuplicateIds(rows);`. In the name `<td>` (where the old Check-eligibility badge sat), after the name link add:

```astro
            {dupIds.has(r.id) && <span class="ml-2 rounded bg-gold-500 px-2 py-1 text-lg font-bold text-stone-900">May be a duplicate</span>}
```

- [ ] **Step 2: Detail note card.** In `[id].astro`: import `listPossibleDuplicates` from the db import list and `centralDate` (already imported? check — add if not). In the GET side, after `detail` loads: `const dups = detail ? await listPossibleDuplicates(env.DB, id) : [];`. Render directly ABOVE the decision-buttons section:

```astro
      {dups.length > 0 && (
        <section class="mt-4 rounded border-l-4 border-gold-500 bg-white p-4" role="note">
          {dups.map((d) => (
            <p class="text-lg">
              <strong>This may be the same household as application #{d.id}</strong>
              {' '}({d.first_name} {d.last_name}, {d.address} — applied {centralDate(d.submitted_at)}{d.source === 'paper' ? ', from paper' : d.source === 'online' ? ', online' : ''}{d.status === 'approved' ? `, already approved${d.pu_number != null ? `, pickup number ${d.pu_number}` : ''}` : ''}).
              Worth comparing before you decide.
              <a href={`/admin/applications/${d.id}`} class="ml-2 font-semibold text-berry-700 underline">See #{d.id}</a>
            </p>
          ))}
        </section>
      )}
```

- [ ] **Step 3: Housekeeping.** In `CLAUDE.md`, replace the non-negotiable line's purge clause:
  old: `never log it in plaintext, never expose it on a public route,\n  and support "download for Excel" plus purge of prior seasons for the admin.`
  new: `never log it in plaintext, never expose it on a public route,\n  and support "download for Excel" for the admin. (Owner decision 2026-07-25: NO purge\n  feature — seasons are kept for the county audit; any future clearing is a developer\n  task on explicit request.)`
  In `docs/decisions.md`: append an entry in the file's existing style, dated 2026-07-25: "No purge feature. The admin will not get a purge-prior-seasons capability (reverses the original CLAUDE.md intent). Records are deliberately kept for the yearly county audit; if the Board ever wants old seasons cleared, it is a developer task on explicit request."

- [ ] **Step 4: Verify and commit** — `npm run build`, `npx tsc --noEmit`, full `npm run test`.

```bash
git add -A
git commit -m "feat(admin): duplicate-application nudge on list and detail; record the no-purge decision"
```

---

## After all tasks (controller/owner)

- Final review, deploy (code-only, no migration), verify live.
- Doc pass: guide (Season summary card + one-line duplicate mention), ops manual (new 6.x screen section for Season summary, duplicate nudge in 6.2/6.3, §8 purge line reworded to "records are deliberately kept for the audit") — artifact AND repo copies; memory.

## Self-review notes (checked against the spec)

- Spec table → getSeasonSummary (Task 1 Step 4); precedence encoded in the towns/groups queries and pinned by test 3; cards regardless of status (no status filter in the cards query) ✓.
- Blank guard in duplicateKey + pinned test ✓. SQL narrows by last name only; the pure lib is the single source of normalization truth ✓.
- Wording matches the spec's calm register; badge reuses the retired Check-eligibility badge slot/visual ✓.
- Types: SeasonSummary/DuplicateCandidate defined in db.ts before use; page consumes exact names; SUM() NULL coalescing handled at return ✓.
