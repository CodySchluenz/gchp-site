# Adoptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sherlyn marks approved, consent-given families as adopted (with adopter details), the family gets her adoption email, adopted families leave the packing flow, and an Adoptions page gives her the letters list.

**Architecture:** Additive migration 0015; db helpers + history composer + email render (all TDD); the Adoption section on the detail page mirrors the decision-buttons patterns; a new Adoptions page mirrors Season summary's shape; exports gain columns with lockstep tests.

**Tech Stack:** Astro 5 + Cloudflare D1 + Vitest. `npm run test`, `npx tsc --noEmit`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-27-adoptions-design.md` — every behavior detail lives there; this plan sequences it.

## Global Constraints

- Consent gate exactly per spec §Owner-approved-decisions #1 (hard gate + plain-English override note; approved status required).
- Email body verbatim from spec §2. With/without-email buttons mirror the approve/deny pattern in `[id].astro` including its no-family-email handling.
- `listApprovedForSlips`: ALL THREE sub-queries gain `AND a.adopted = 0` (apps, cities, members — they repeat the filter; missing one breaks the exclusion silently).
- Sherlyn's sheet: `Adopted by` inserted directly after `adopted` (12 columns; header test updated to the exact new array). Backup gains the five columns per spec §4.
- `clearAdoption` keeps the adopter fields (re-marking convenience) — pin with a test.
- History area `decision`; sentences per spec. Straight apostrophes. Additive migrate-first deploy.

---

### Task 1: Data + email + composer layer (TDD)

**Files:**
- Create: `migrations/0015_adoptions.sql` (spec SQL verbatim + dated comment), `tests/db-adoptions.test.ts`
- Modify: `tests/helpers/d1.ts` (append 0015), `src/lib/db.ts`, `src/lib/history.ts` (+`tests/history.test.ts`), `src/lib/email/render.ts` (+its test file — find the file that pins renderApprovedEmail and mirror it), `src/lib/export-columns.ts` (+`tests/export-columns.test.ts`)

**Interfaces (produced — Tasks 2-3 depend on exact names):**

```ts
// db.ts
export type AdoptionFields = { adopterName: string; adopterContact: string; adopterPhone: string; adopterAddress: string };
export async function setAdoption(db: D1Database, id: number, f: AdoptionFields): Promise<void>;   // adopted=1 + fields
export async function clearAdoption(db: D1Database, id: number): Promise<void>;                    // adopted=0, fields KEPT
export type AdoptionRow = { id: number; first_name: string; last_name: string; city_name: string; pu_number: number | null; adopter_name: string; adopter_contact: string; adopter_phone: string; adopter_address: string };
export async function listAdoptions(db: D1Database, seasonYear: number): Promise<AdoptionRow[]>;   // adopted=1, non-deleted, ORDER BY adopter_name, id
// getSeasonSummary gains `adopted: number` (approved AND adopted=1); SeasonSummary type updated.
// ApplicationListRow + listApplications cols gain `adopted`.
// ExportRow + listApplicationsForExport SELECT gain adopted, adopter_name, adopter_contact, adopter_phone, adopter_address.

// history.ts
export function describeAdoption(kind: 'marked' | 'unmarked' | 'updated', adopterName: string, mail: 'sent' | 'failed' | 'none'): string;

// email/render.ts
export function renderAdoptedEmail(firstName: string): { subject: string; text: string } // match the house render return shape exactly
```

Steps: write failing tests per the spec's Testing section (db round-trips incl. clearAdoption-keeps-fields and the slips-exclusion case; composer arms; email render pinning the spec §2 body; export lockstep — sherlynHeaders 12-column exact array, fullHeaders/fullRow additions) → implement → green → full suite + tsc + build → commit:

```bash
git commit -m "feat(db+lib): adoptions data layer — migration 0015, setAdoption/clearAdoption/listAdoptions, history sentences, adoption email, export columns (TDD)"
```

### Task 2: The detail-page Adoption section + packing-flow exclusion + list tag

**Files:** `src/pages/admin/applications/[id].astro`, `src/lib/db.ts` (`listApprovedForSlips` — the three `AND a.adopted = 0` additions), `src/pages/admin/applications/index.astro` (tag), `tests/db-admin-slips.test.ts` (exclusion case if not already in Task 1)

Behavior per spec §Behavior bullet 1 (gate, fields, buttons incl. email-presence handling copied from the approve buttons, already-adopted state, Remove adoption mark) + §3 (slip-button note "Adopted household — no packing slip; the adopting organization or family provides their gifts.", list tag `Adopted` in the name cell, holly-tinted like the duplicate badge but calm). POST actions: `mark_adopted_email` / `mark_adopted_silent` / `save_adoption` / `clear_adoption` — each: save → history (describeAdoption) → redirect with banner cases ("Marked as adopted. The email was sent." etc. — mirror the approve banner+mailNote composition). Commit:

```bash
git commit -m "feat(admin): Adoption section — consent-gated marking with her email; adopted families leave the packing flow"
```

### Task 3: Adoptions page + summary line + nav/home

**Files:** Create `src/pages/admin/adoptions.astro` (mirror `season-summary.astro`'s frame: season param convention, picker, Print button, print CSS); modify `AdminNav.astro` (entry after Season summary), `AdminHome.astro` (card), `src/pages/admin/season-summary.astro` (the "Of the families served, adopted out: N." line, rendered only when N > 0, in the Applications card).

Table columns per spec; empty state "No families adopted out yet this season."; count line "Adopted out this season: N". Commit:

```bash
git commit -m "feat(admin): Adoptions page — the letters list; season summary counts adopted-out families"
```

## After all tasks (controller)

Final whole-branch review (opus) → fix wave if needed → deploy MIGRATE-FIRST (0015) → verify live → push → guide + manual + repo-copy doc pass → memory.

## Self-review notes

- Spec §data → T1; §behavior 1-3 → T2; §behavior 4-6 → T1 (db) + T3 (pages); §privacy enforced by existing scan tests (adopter fields never enter SlipCard — adopted families are excluded before rendering anyway) — T2's exclusion test is the real guard.
- Type coherence: AdoptionFields/AdoptionRow defined T1, consumed T2/T3 by exact name; sherlynHeaders 12-entry array pinned in T1's test so T2/T3 can't drift it.
- The approve-buttons' email-presence pattern is referenced, not restated — implementer reads the real file (it has shifted across batches; content anchors beat line numbers).
