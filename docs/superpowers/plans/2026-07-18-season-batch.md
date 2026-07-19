# Season Batch — Distribution Aids & Error Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gifts column in the Excel export; data-driven town→pickup-day links that auto-fill printed slips (unset = today's behavior); a printable color-coded box-cards page; and an unmissable error treatment on the applicant form.

**Architecture:** Migration `0008` (nullable `cities.pickup_day_id` + `settings.straggler_pickup_day_id`); `listApprovedForSlips` resolves each application's day; the Pickup schedule screen gains a town→day assignment section; new `/admin/applications/cards` print page reuses the slips data; the export gains a `gifts_summary` aggregate; `/apply` gets banner restyle + `[aria-invalid]` CSS + an apply.js focus enhancement.

**Tech Stack:** Astro 5 (server, Cloudflare adapter), Tailwind 4 (`@theme` tokens in `src/styles/global.css`), Cloudflare D1, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-season-batch-design.md`.

## Global Constraints

- **Unset day = today's behavior**: with no assignments, slips print byte-identically to before. Soft-deleted pickup days never match. Mailed households keep getting no slips/cards.
- Box cards carry **no family names** (deliberate — boxes sit in a garage). Stragglers get a black band labeled STRAGGLER.
- Export header/row arrays stay aligned; "Gifts requested" sits immediately after "People".
- `/apply` changes are markup/CSS/enhancement only: field names unchanged, nothing typed ever wiped, works with JS disabled (banner jump-links + red field flagging are the no-JS guarantees; focus-jump is the JS extra). WCAG AA contrast: berry-700 (#b91c1c) and berry-800 (#991b1b) text on berry-100 (#fee2e2) both pass.
- Admin: CSRF on the new mutating POST; plain English; straight apostrophes; no inline scripts.

---

## Task 1: "Gifts requested" in the Excel export

**Files:**
- Modify: `src/lib/db.ts` (`ExportRow` ~:460s; the export SELECT's GROUP_CONCAT block)
- Modify: `src/pages/admin/applications/export.xlsx.ts` (headers + row)
- Modify: `tests/db-admin-export.test.ts` (one test)

**Interfaces:** `ExportRow` gains `gifts_summary: string`.

- [ ] **Step 1: Failing test** — in `tests/db-admin-export.test.ts`, add (own `getTestDb()` try/finally, per the file's pattern; `base` fixture is in the file):

```ts
  it('summarizes gift requests per person', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await insertApplication(db, {
        ...base, lastName: 'Gifty',
        members: [
          { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'bike' },
          { name: 'Ann Smith', relationship: 'daughter', sex: 'F', age: 5, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'books' },
        ],
      });
      await insertApplication(db, { ...base, lastName: 'NoGifts' });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      expect(rows.find((r) => r.last_name === 'Gifty')?.gifts_summary).toBe('Tim Smith: bike; Ann Smith: books');
      expect(rows.find((r) => r.last_name === 'NoGifts')?.gifts_summary).toBe('');
    } finally { await dispose(); }
  });
```

Run: `npx vitest run tests/db-admin-export.test.ts` — FAIL (`gifts_summary` undefined).

- [ ] **Step 2: Implement** — `ExportRow` gains `gifts_summary: string;`. In the export SELECT, directly after the `member_summary` GROUP_CONCAT expression (before `employment_summary`), add:

```sql
           COALESCE(GROUP_CONCAT(CASE WHEN m.gifts != '' THEN m.name || ': ' || m.gifts END, '; '), '') AS gifts_summary,
```

(GROUP_CONCAT skips the NULLs the ELSE-less CASE produces, and member join order follows the existing GROUP BY — same as member_summary.)

In `export.xlsx.ts`: insert `'Gifts requested'` in `headers` immediately after `'People'`, and `r.gifts_summary` in the row immediately after `r.member_summary`. Count both arrays after editing — equal length, same index.

- [ ] **Step 3: Green + suite** — focused file, then `npm test`, `npx tsc --noEmit`. All pass.
- [ ] **Step 4: Commit** — `git add src/lib/db.ts src/pages/admin/applications/export.xlsx.ts tests/db-admin-export.test.ts` · message: `feat(export): Gifts requested column — per-person asks for the distributor sheet`

---

## Task 2: Migration 0008 + day assignment + slips resolution (db layer)

**Files:**
- Create: `migrations/0008_town_pickup_days.sql`
- Modify: `tests/helpers/d1.ts:11` (loop)
- Modify: `src/lib/db.ts` — `Settings`/`getSettings` (:16-30), `City`/`listCities` (:90s), `ApplicationDetail` type, `listApprovedForSlips`; new setters
- Create: `tests/db-town-pickup-days.test.ts`
- Modify: `tests/d1-schema.test.ts` (one case)

**Interfaces (Tasks 3-4 rely on):**
- `Settings` gains `straggler_pickup_day_id: number | null` (getSettings SELECT extended).
- `City` gains `pickup_day_id: number | null` (listCities SELECT extended — additive; existing consumers unaffected).
- `setCityPickupDay(db, cityId: number, dayId: number | null): Promise<void>`
- `setStragglerPickupDay(db, dayId: number | null): Promise<void>`
- `ApplicationDetail` gains `pickup_day: { date_text: string; description: string } | null` (always present on slips results; `getApplicationDetail` may return it as `null` without resolving — document with a comment).

- [ ] **Step 1: Migration + harness**

```sql
-- Town -> pickup-day links (2026-07-18 season-batch spec). NULLABLE ON
-- PURPOSE: unset means pickup slips print with no date, exactly as before.
-- The operator assigns days on the Pickup schedule screen; clearing them
-- turns the feature back off. Soft references (SQLite ALTER cannot add FKs):
-- a deleted pickup day simply stops matching.
ALTER TABLE cities ADD COLUMN pickup_day_id INTEGER;
ALTER TABLE settings ADD COLUMN straggler_pickup_day_id INTEGER;
```

Append `'migrations/0008_town_pickup_days.sql'` to the harness loop.

- [ ] **Step 2: Failing tests** — create `tests/db-town-pickup-days.test.ts` (fixture: copy `base` from `tests/db-source.test.ts`; imports: `insertApplication, setApplicationStatus, setStraggler, createPickupDay, softDeletePickupDay, setCityPickupDay, setStragglerPickupDay, getSettings, listCities, listApprovedForSlips`):

```ts
describe('town pickup-day links', () => {
  it('assigns, resolves on slips, clears, and ignores deleted days', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await createPickupDay(db, { date_text: 'Dec 9', description: 'Lancaster families, 10-2' });
      const day = (await db.prepare("SELECT id FROM pickup_days WHERE date_text = 'Dec 9'").first<{ id: number }>())!.id;

      const fam = await insertApplication(db, base);
      const str = await insertApplication(db, { ...base, lastName: 'Late' });
      await setStraggler(db, str, true);
      await setApplicationStatus(db, fam, 'approved');
      await setApplicationStatus(db, str, 'approved');

      // Unset: no date line for anyone (today's behavior).
      let slips = await listApprovedForSlips(db, 2026);
      expect(slips.every((s) => s.pickup_day === null)).toBe(true);

      // Town day set: the family resolves it; the straggler does NOT.
      await setCityPickupDay(db, 13, day);
      expect((await listCities(db)).find((c) => c.id === 13)?.pickup_day_id).toBe(day);
      slips = await listApprovedForSlips(db, 2026);
      expect(slips.find((s) => s.app.last_name === 'Smith')?.pickup_day?.date_text).toBe('Dec 9');
      expect(slips.find((s) => s.app.last_name === 'Late')?.pickup_day).toBeNull();

      // Straggler day set: the straggler resolves that one.
      await setStragglerPickupDay(db, day);
      expect((await getSettings(db)).straggler_pickup_day_id).toBe(day);
      slips = await listApprovedForSlips(db, 2026);
      expect(slips.find((s) => s.app.last_name === 'Late')?.pickup_day?.description).toContain('Lancaster');

      // Deleted day: resolution vanishes; clearing works.
      await softDeletePickupDay(db, day, '2026-10-02T00:00:00Z');
      slips = await listApprovedForSlips(db, 2026);
      expect(slips.every((s) => s.pickup_day === null)).toBe(true);
      await setCityPickupDay(db, 13, null);
      await setStragglerPickupDay(db, null);
      expect((await getSettings(db)).straggler_pickup_day_id).toBeNull();
    } finally { await dispose(); }
  });
});
```

Plus in `tests/d1-schema.test.ts`: pragma check that `cities.pickup_day_id` and `settings.straggler_pickup_day_id` exist.

Run focused — FAIL (setters missing).

- [ ] **Step 3: Implement in db.ts**

```ts
export async function setCityPickupDay(db: D1Database, cityId: number, dayId: number | null): Promise<void> {
  await db.prepare('UPDATE cities SET pickup_day_id = ? WHERE id = ?').bind(dayId, cityId).run();
}

export async function setStragglerPickupDay(db: D1Database, dayId: number | null): Promise<void> {
  await db.prepare('UPDATE settings SET straggler_pickup_day_id = ? WHERE id = 1').bind(dayId).run();
}
```

`Settings` + getSettings SELECT gain `straggler_pickup_day_id` (`number | null`). `City` + listCities SELECT gain `pickup_day_id`. `ApplicationDetail` gains `pickup_day: { date_text: string; description: string } | null;` — in `getApplicationDetail`, return `pickup_day: null` (comment: resolved only by the slips path). In `listApprovedForSlips`: extend the cities helper query to also select `c.pickup_day_id`; fetch non-deleted days (`SELECT id, date_text, description FROM pickup_days WHERE deleted_at IS NULL`) and the settings row's `straggler_pickup_day_id` in the same `Promise.all`; build `dayById`; per app resolve `app.straggler === 1 ? stragglerDayId : cityPickupDayId` through `dayById` (missing/deleted → null) and return it as `pickup_day`.

- [ ] **Step 4: Green + suite** — focused, then `npm test`, `npx tsc --noEmit`. (The existing slips tests must still pass — `pickup_day` is additive and null when unset.)
- [ ] **Step 5: Commit** — message: `feat(db): town and straggler pickup-day links resolved onto slips — unset means unchanged`

---

## Task 3: Pickup-schedule assignment UI + the slip date line

**Files:**
- Modify: `src/pages/admin/pickup/index.astro` (new act + new section)
- Modify: `src/components/admin/SlipCard.astro` (one line)

**Interfaces:** consumes Task 2's setters, `listCities`, `Settings.straggler_pickup_day_id`, `ApplicationDetail.pickup_day`.

- [ ] **Step 1: The act** — in `pickup/index.astro`'s POST handler (inside the CSRF-ok block), add:

```ts
    } else if (act === 'save_town_days') {
      const cities = await listCities(env.DB);
      for (const c of cities) {
        const raw = String(form.get(`day_city_${c.id}`) ?? '').trim();
        await setCityPickupDay(env.DB, c.id, /^\d+$/.test(raw) ? Number(raw) : null);
      }
      const sRaw = String(form.get('day_straggler') ?? '').trim();
      await setStragglerPickupDay(env.DB, /^\d+$/.test(sRaw) ? Number(sRaw) : null);
      return Astro.redirect('/admin/pickup?saved=towndays', 303);
    }
```

Extend the import from db with `listCities, setCityPickupDay, setStragglerPickupDay`; extend the banner chain with `: saved === 'towndays' ? 'Pickup days for towns saved.'`. Frontmatter also loads `const cities = await listCities(env.DB);` for the template.

- [ ] **Step 2: The section** — after the "Add a pickup day" section, add:

```astro
  <section class="mt-8 rounded-lg border-2 border-stone-300 bg-white p-5">
    <h2 class="text-2xl font-bold text-holly-800">Which day does each town pick up?</h2>
    <p class="mt-1 text-lg text-stone-600">This fills the pickup date in on each family's printed
      pickup slip. Leave a town on "Not set" and its slips print with a blank date, like before.</p>
    <form method="post" class="mt-3 space-y-2">
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {cities.map((c) => (
        <label class="flex flex-wrap items-center gap-3 font-semibold">
          <span class="w-44">{c.name}</span>
          <select name={`day_city_${c.id}`} class="rounded border-2 border-stone-400 bg-white p-2 text-lg">
            <option value="">Not set</option>
            {days.map((d: AdminPickupDay) => (
              <option value={String(d.id)} selected={c.pickup_day_id === d.id}>{d.date_text}{d.description ? ` — ${d.description}` : ''}</option>
            ))}
          </select>
        </label>
      ))}
      <label class="flex flex-wrap items-center gap-3 font-semibold">
        <span class="w-44">Stragglers</span>
        <select name="day_straggler" class="rounded border-2 border-stone-400 bg-white p-2 text-lg">
          <option value="">Not set</option>
          {days.map((d: AdminPickupDay) => (
            <option value={String(d.id)} selected={settings.straggler_pickup_day_id === d.id}>{d.date_text}{d.description ? ` — ${d.description}` : ''}</option>
          ))}
        </select>
      </label>
      <button type="submit" name="act" value="save_town_days"
        class="mt-2 rounded bg-holly-700 px-4 py-2 font-bold text-white hover:bg-holly-900">Save pickup days for towns</button>
    </form>
  </section>
```

(`days` and `settings` are already loaded by the page.)

- [ ] **Step 3: The slip line** — in `SlipCard.astro`, directly after the address `<p>`, add:

```astro
  {detail.pickup_day && (
    <p class="pickup"><strong>Pickup:</strong> {detail.pickup_day.date_text}{detail.pickup_day.description ? ` — ${detail.pickup_day.description}` : ''}</p>
  )}
```

and to its `<style>`: `.pickup { font-size: 16px; margin: 4px 0; }`

- [ ] **Step 4: Verify** — `npm run build`, `npx tsc --noEmit`, `npm test` (slip logic is db-tested in Task 2).
- [ ] **Step 5: Commit** — message: `feat(admin): assign pickup days by town; slips print the date only when set`

---

## Task 4: Printable box cards

**Files:**
- Create: `src/pages/admin/applications/cards.astro`
- Modify: `src/pages/admin/applications/index.astro` (one link beside the slips link at ~:145)

**Interfaces:** consumes `listApprovedForSlips` (already excludes mailed; includes `city_name` and `app.straggler`).

- [ ] **Step 1: The page** — create `cards.astro` modeled on `slips.astro`:

```astro
---
import { listApprovedForSlips } from '../../../lib/db';
export const prerender = false;
const season = Number(new URL(Astro.request.url).searchParams.get('season')) || new Date().getFullYear();
const slips = await listApprovedForSlips(Astro.locals.runtime.env.DB, season);
// One fixed, print-safe color per town (keyed by city id, stable year to year).
// Stragglers get black. Bands print because of print-color-adjust below.
const PALETTE = [
  '#1a6b3a', '#b91c1c', '#1d4ed8', '#b45309', '#6d28d9', '#0f766e',
  '#be185d', '#4d7c0f', '#c2410c', '#0e7490', '#7c2d12', '#365314',
  '#86198f', '#1e40af', '#991b1b', '#065f46', '#92400e', '#5b21b6',
  '#155e75', '#9d174d', '#3f6212', '#7e22ce', '#166534',
];
const bandFor = (d: (typeof slips)[number]) =>
  d.app.straggler === 1 ? '#000000' : PALETTE[(Number(d.app.city_id) - 1) % PALETTE.length];
const labelFor = (d: (typeof slips)[number]) => (d.app.straggler === 1 ? 'STRAGGLER' : d.city_name);
---
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Box cards {season}</title></head>
  <body style="margin:16px;font-family:system-ui,sans-serif;">
    <p class="no-print"><a href="/admin/applications">&larr; Back to applications</a> ·
      <button type="button" data-print>Print all {slips.length} cards</button></p>
    <h1 class="no-print" style="font-size:20px;">Box cards — {season} ({slips.length})</h1>
    {slips.length === 0 && <p>No approved applications yet.</p>}
    <div class="sheet">
      {slips.map((d) => (
        <article class="card">
          <div class="band" style={`background:${bandFor(d)}`}>{labelFor(d)}</div>
          <p class="num">{d.app.pu_number ?? '____'}</p>
          <p class="bags">Bags: {d.app.bags_count ?? '____'}</p>
        </article>
      ))}
    </div>
    <style>
      .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .card { border: 2px solid #000; break-inside: avoid; text-align: center; padding-bottom: 12px; }
      .band { color: #fff; font-weight: 700; font-size: 20px; letter-spacing: 0.06em;
              padding: 8px 4px; text-transform: uppercase;
              print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .num { font-size: 64px; font-weight: 800; margin: 10px 0 0; font-variant-numeric: tabular-nums; }
      .bags { font-size: 22px; font-weight: 600; margin: 4px 0 0; }
      @media print { .no-print { display: none; } .sheet { gap: 12px; } }
    </style>
    <script src="/scripts/print-button.js" defer></script>
  </body>
</html>
```

- [ ] **Step 2: The link** — in `index.astro`, next to the "Print all approved slips" link, add:

```astro
    <a href={`/admin/applications/cards?season=${season}`} class="rounded border-2 border-holly-700 px-4 py-2 font-semibold text-holly-800 hover:bg-holly-100">Print box cards</a>
```

- [ ] **Step 3: Verify** — `npm run build`, `npx tsc --noEmit`, `npm test`.
- [ ] **Step 4: Commit** — message: `feat(admin): printable box cards — town color band, big pickup number, bag count, no names`

---

## Task 5: Applicant error visibility

**Files:**
- Modify: `src/pages/apply.astro` (the banner at ~:177-183 only)
- Modify: `src/styles/global.css` (one rule block)
- Modify: `public/scripts/apply.js` (a few lines inside the existing IIFE)

**Interfaces:** none new. Field names, validation, and re-render values untouched.

- [ ] **Step 1: Banner** — replace the banner's container and heading classes (keep the count text, the `<ul>`, and the jump links EXACTLY as they are):

```astro
      {errorEntries.length > 0 && (
        <div class="mt-4 rounded-lg border-2 border-berry-700 bg-berry-100 p-5" role="alert">
          <p class="text-xl font-bold text-berry-800">Almost there — please check {errorEntries.length === 1 ? 'this one thing' : `these ${errorEntries.length} things`}:</p>
          <ul class="mt-2 list-disc pl-6">
            {errorEntries.map(([field, msg]) => (
              <li><a href={`#${field}`} class="font-semibold text-berry-800 underline">{msg}</a></li>
            ))}
          </ul>
        </div>
      )}
```

(berry-800 on berry-100 ≥ 7:1 — AA satisfied.)

- [ ] **Step 2: Field flagging** — in `src/styles/global.css`, after the `@theme` block:

```css
/* Missed or invalid fields are flagged at the field itself. The server sets
   aria-invalid on every field with an error; this makes that state visible
   while scrolling — it works with JavaScript disabled. */
input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"] {
  border-color: var(--color-berry-700);
  background-color: var(--color-berry-100);
}
```

- [ ] **Step 3: Focus enhancement** — inside `public/scripts/apply.js`'s IIFE, at the end:

```js
  // If the server re-rendered with validation errors, take the applicant to
  // the first one. Without JavaScript the loud banner (with its jump links)
  // and the red field flagging carry this on their own.
  var firstInvalid = document.querySelector('[aria-invalid="true"]');
  if (firstInvalid && firstInvalid.focus) firstInvalid.focus();
```

- [ ] **Step 4: Verify** — `npm run build`, `npx tsc --noEmit`, `npm test` (validation tests unchanged). State in the report: banner classes verbatim, CSS selector list verbatim, apply.js addition inside the IIFE.
- [ ] **Step 5: Commit** — message: `fix(apply): unmissable error banner, red field flagging, focus jump to the first problem`

---

## After all tasks (not code)

- Deploy needs migration 0008 FIRST (additive), then build + deploy — same runbook section.
- Tell Sherlyn: the export now has the gifts column for distributors; box cards print from the Applications screen; and IF she wants dates on slips, she assigns each town a day at the bottom of the Pickup schedule screen (leaving them "Not set" keeps slips exactly as she knows them).
