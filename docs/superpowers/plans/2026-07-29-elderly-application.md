# Elderly/Disabled Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/apply` becomes the Family vs Elderly/Disabled chooser Sherlyn sketched; a short elderly form (her paper form, online) feeds the existing 2500/mailed pipeline; approval emails branch; Christmas-card mailing labels; the 65+-in-family finder; a second paper PDF slot.

**Architecture:** New pure validator + email render (TDD) → route restructuring (chooser + moved family form + new short form, all closed-gated) → admin touches (email branch, finder, labels, PDF slot). One additive migration (0016, settings column). `insertApplication` unchanged — the short form produces a standard `NewApplication`.

**Tech Stack:** Astro 5 + Cloudflare D1 + R2 + Resend + Vitest. `npm run test`, `npx tsc --noEmit`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-07-29-elderly-application-design.md` — the behavior source of truth; this plan sequences it. Where this plan is thinner than usual, the spec section named in the task governs.

## Global Constraints

- Applicant surface rules: JS-optional (no conditional reveal — the chooser is two links), 360px, WCAG AA, warm low-reading-level copy, kind errors, NEVER wipe typed input on validation errors (the family form's values-re-render pattern is the contract).
- The applicant's household-type choice is a declaration, not a gate — no eligibility automation anywhere.
- `/apply` keeps its URL/title/canonical. Family form moves to `/apply/family` VERBATIM in behavior (same field names, same validators, same POST-to-self, same thank-you redirect) — only paths/imports change.
- Elderly form defaults per spec: bed `'none'`, diabetic 0, sponsor 0, residence-confirmed 1, members' sex/relationship/sizes/gifts/doll all `''`.
- Email bodies verbatim per spec; subjects house-style. Straight apostrophes.
- Labels: Avery 5160 (3 × 10, 1in × 2.625in); approved + mailed types + `adopted = 0` + non-deleted + season.
- All three public pages honor the closed gate with the existing closed copy.
- Migration 0016 additive; migrate-first deploy.

---

### Task 1: Validator + emails (pure layer, TDD)

**Files:** Create `src/lib/validation/application-elderly.ts`, `tests/application-elderly-validation.test.ts`; modify `src/lib/email/render.ts` + its test file.

**Interfaces (produced):**

```ts
// application-elderly.ts — mirrors validateApplication's result contract
export type ElderlyApplicationResult =
  | { ok: true; clean: CleanApplication & { householdType: 'elderly' | 'disabled' } }
  | { ok: false; errors: Errors };
export function validateElderlyApplication(input: ApplicationInput): ElderlyApplicationResult;
// Field names: first_name, last_name, address, city_id, phone, email, email_confirm,
// household_kind ('elderly' | 'disabled', required radio), member_count + member_name_i/member_age_i,
// the EXISTING employment + benefits field names (reuse validateEmployment/validateBenefits verbatim),
// years_received_help, good_deed. Members: name+age required per non-blank row; row 1 required;
// blank extra rows skipped (family-form convention). Clean members get sex:'', relationship:'',
// all sizes/gifts/doll '' ; person 1 relationship 'self'. Defaults per Global Constraints.

// render.ts
export function renderElderlyApprovedEmail(firstName: string): RenderedEmail; // body verbatim per spec
```

Steps: failing tests first (about requirements mirroring validateAbout's rules incl. email-confirm; household_kind radio required + junk rejected kindly; member rows incl. add-row skip/require logic and age 0-110; benefits/employment pass-through incl. their error keys; full ok-case produces the exact defaults; never-wipe = errors object keys match field names). Then implement (compose existing validators — do NOT duplicate their logic). Email test mirrors the adopted-email test incl. phone-number assertion. Full suite + tsc + build. Commit: `feat(validation+email): elderly application validator and approval email (TDD)`

### Task 2: The three public routes

**Files:** Move `src/pages/apply.astro` → `src/pages/apply/family.astro` (git mv; fix relative import depths, keep `/scripts/apply.js` references); create new `src/pages/apply.astro` (chooser) and `src/pages/apply/elderly.astro`; check `public/scripts/apply.js` selectors work on the elderly form's member rows (name+age only — if its member-add cloning is MemberCard-specific, give the elderly page its own minimal template/clone block or reuse; judgment, report it).

Chooser (`/apply`): closed gate first (existing copy); when open — h1 "Apply for Holiday Help", one plain sentence ("Pick the application that fits your household — both are short."), two link-cards per spec wording (Family Household — children under 18 / Elderly-Disabled Household — over 65, or receiving Social Security or SSI for a disability), then the phone-line/paper fallbacks section from the current page with BOTH PDFs listed (family + elderly — the elderly link may 404 until the owner uploads; the route's fallback message covers it). Meta description updated per spec.

`/apply/family`: the moved file; add its own title/description; everything else identical (verify by diff that only frontmatter paths/description changed).

`/apply/elderly`: mirrors the family page's skeleton (closed gate, POST-to-self, `validateElderlyApplication`, values re-render on errors, honeypot/rate-limit/CSRF — copy whatever protections the family POST has, identically), builds the `NewApplication` with the spec defaults, `insertApplication`, same received email + thank-you redirect. Warm copy per her paper form's framing ("You will receive your gifts in the mail." near the top). Add-person rows: name + age pairs.

Update `tests/seo.test.ts` description-presence list (+2 files). Full suite + tsc + build; manually curl-render all three pages in `npm run build` output or dev — build-verified per house pattern. Commit: `feat(apply): the Family vs Elderly-Disabled chooser — her paper world's two doors, online`

### Task 3: Approval-email branch + the 65+ finder

**Files:** `src/pages/admin/applications/[id].astro` (approve branches pick `renderElderlyApprovedEmail` when `household_type` IN elderly/disabled), `src/lib/db.ts` (`ApplicationListRow.has_elderly_member` — EXISTS subquery: family-type rows only, non-deleted member `age >= 65`; others 0), `src/pages/admin/applications/index.astro` (badge `65+ in household`), detail note card above decision buttons (compute from `detail.members` in TS: family type + any age ≥ 65 → name+age of the oldest such member), tests (db flag: boundary 65 in / 64 out, soft-deleted member excluded, non-family excluded).

History note: approval sentences unchanged (the email choice doesn't change "Approved" wording — mail suffix already covers sent/failed). Commit: `feat(admin): elderly approval email + the 65-plus-in-family finder`

### Task 4: Mailing labels + the elderly paper PDF

**Files:** Create `src/pages/admin/applications/labels.astro` (Avery 5160 print grid; data = `listApplications(db, season, 'approved', '', 'mailed')` filtered `adopted !== 1`... prefer a small dedicated `listMailedForLabels(db, season)` in db.ts (approved, mailed types, adopted=0, non-deleted, ordered by city then last name) with a test; label = name / address / "{city}, WI"); button "Print mailing labels" on `index.astro` visible in the mailed view; create `migrations/0016_elderly_pdf.sql` (`ALTER TABLE settings ADD COLUMN elderly_pdf_uploaded_at TEXT;`) + harness append + d1-schema case; create `src/pages/elderly-application.pdf.ts` (mirror `application.pdf.ts`, key `elderly-application.pdf`); `src/lib/db.ts` Settings type + `setElderlyPdfUploadedAt`; admin `paper-application/index.astro` second upload block (mirror the first, incl. the one-button JS if generic — judgment); chooser/elderly-page links (Task 2 already placed them). Commit: `feat(admin): Christmas-card mailing labels (Avery 5160) + the elderly paper application slot`

---

## After all tasks (controller)

Final whole-branch review (opus; consent-free batch but applicant-surface — priority on the never-wipe contract, closed gates, and the moved family form's behavioral identity) → fix wave → deploy MIGRATE-FIRST (0016) with the stop-on-error rule → verify live (all three apply routes, labels 303, pdf route fallback) → push → guide + manual + repo copy (new applying flow, labels, second PDF, finder) → memory. Owner afterward: upload the elderly PDF via the admin.

## Self-review notes

- Spec sections map: shape→T2; short form→T1+T2; after→T3; labels→T4; finder→T3; PDF→T4; SEO→T2; testing distributed per task.
- The moved family form is the riskiest piece: T2 pins "verify by diff that only paths/description changed"; the final review re-verifies.
- No new applications columns — household_type carries everything; 0016 touches settings only.
