# Application Relationships & Eligibility-Review Data — Design

**Date:** 2026-07-15
**Origin:** Operator (Sherlyn) reviewed the live application and found it was missing the
household relationship information she needs to determine eligibility. This spec makes the
online application capture — clearly and per person — the facts she hand-calculates
eligibility from, and surfaces them for her review.

## Guiding principle (confirmed with the operator)

**The software never decides eligibility and never auto-denies.** Eligibility for this
government-linked charity is a manual determination Sherlyn makes by hand (relationship +
disability + income vs. the yearly federal poverty level). Our only job is to **capture the
relationships, disability, and income clearly, and show them to her.** She decides who is in,
who is out, and who gets what.

Her rules, in her words, for reference (NOT to be encoded as automatic logic):
- Eligible = **parents/guardians and the children who live in the home.**
- Children must live in the home **at least half the time.**
- Other adults in the home (boyfriend, uncle, roommate) who are **not** a parent/guardian of
  the children are **not** part of the eligible family — but she does **not** deny the whole
  application over one ineligible person; the family is still served.
- Any individual — including such an adult — who is **permanently disabled** (or over 65) may
  be eligible **on their own**, and those individuals just receive **a gift card and a food
  card**, not the full family package.
- A partner may be the parent of **some** of the children and not others ("one child might be
  theirs and the rest not"), so parentage is per-child, not one yes/no.

## Non-negotiables carried from the project (must hold)

- Applicant form stays **mobile-first, effortless, low reading level**; every added field is
  justified and, where possible, optional. Works at 360px.
- **Form works with JavaScript disabled.** No new field may depend on JS to appear or submit.
  (No conditional reveal — new questions are always visible and clearly optional.)
- **Never wipe what the applicant typed** on a validation error.
- Admin stays large (≥18px), plain-English, text-labeled buttons; every mutating POST enforces
  CSRF; admin responses `no-store`.
- Straight apostrophes only in code copy. CSP: no inline handlers/scripts.
- Sensitive PII: never logged in plaintext, never on a public route.

## Judgment call for the operator to confirm (does not block the build)

The current paper application exists in two page-2 revisions. This spec uses the **superset
relationship list** — it keeps the newer form's clean framing AND the older form's
eligibility-relevant categories (Grandchild, Court-appointed), because those map directly to
her "parents, guardians, and children are eligible" rule and shouldn't be buried under
"Other." If she prefers the shorter list (*Son · Daughter · Not related · Other*), it is a
one-line change to the options array.

Relationship options (canonical value → label shown):

| value | label |
|---|---|
| `self` | Myself (head of household) |
| `other_parent` | The other parent |
| `son` | Son |
| `daughter` | Daughter |
| `grandchild` | Grandchild |
| `court` | Court-appointed (foster child or guardianship) |
| `not_related` | Not related (boyfriend, roommate, other adult) |
| `other` | Other — described below |

## Scope

### 1. Per-person relationship becomes a dropdown
- **File:** `src/components/apply/MemberCard.astro`, new `src/lib/relationships.ts`.
- Replace the free-text "How are they related to you?" input with a `<select>` built from a
  shared `RELATIONSHIP_OPTIONS` constant, plus a small always-visible "If 'Other', describe"
  text input (`member_relationship_other_{i}`), optional, used only when `other` is chosen.
- Person 1 still defaults to `self`.
- `src/lib/relationships.ts` exports:
  - `RELATIONSHIP_OPTIONS: { value: string; label: string }[]`
  - `relationshipLabel(value: string, other: string): string` — known code → label; `other` →
    the other-text; **unknown/legacy value → the raw value** (so migrated blank/free-text rows
    still render sensibly; `''` → `—`).
  - `NON_FAMILY_RELATIONSHIPS = new Set(['not_related'])` — drives the admin "verify" tag.

### 2. Per-person "permanently disabled" checkbox (consolidates the old household question)
- **Files:** `MemberCard.astro`, `apply.astro`, `validation/application.ts`, `eligibility.ts`.
- Add a checkbox per member: `member_disabled_{i}` — "This person is permanently disabled."
- **Remove** the single household-level radio "Is anyone in your household permanently
  disabled?" (`permanently_disabled`) from `apply.astro` and `validateAbout`. It becomes
  redundant and does not tell Sherlyn *who*.
- Derive the application-level flag: `permanentlyDisabled = members.some(m => m.disabled)`.
  Compute it in `validateApplication` assembly and keep writing it to
  `applications.permanently_disabled` so `eligibility.ts` (`mayNotBeEligible`,
  `suggestHouseholdType`) and the existing `household_type` logic keep working unchanged.

### 3. Blended-family parentage note (Option 1, chosen)
- **Files:** `apply.astro` (Household section), `validation/application.ts`, DB, admin.
- One optional textarea in the Household section: `parentage_note` —
  "If a partner or another adult in your home is a parent of only some of your children, tell
  us which children are theirs. Leave blank if this does not apply."
- Validate: optional, trimmed, max 2000 chars.

### 4. Shoe size + coat size added to clothing needs
- **Files:** `MemberCard.astro`, `validation/application.ts`, DB, admin members editor, export.
- Add `member_shoe_{i}` and `member_coat_{i}` free-text size fields alongside the existing
  pants/shirt/underwear/socks/diapers. Optional, like the others.

### 5. Part-time child marker + "must live here at least half the time"
- **Files:** `MemberCard.astro`, `apply.astro`, `validation/application.ts`, DB, admin.
- Add a checkbox per member: `member_part_time_{i}` — "Lives in my home only part of the time."
- Reword the existing residence confirmation (`full_time_residence`) so it no longer claims
  everyone is full-time (which contradicts allowed part-time children): 
  "Everyone I have listed lives in my home (children at least half of the time)." Keep it a
  required checkbox; keep the field name `full_time_residence` to avoid churn.
- Add a plain sentence to the Household section: "Children must live in your home at least half
  of the time to be listed."

### 6. Private admin notes per application
- **Files:** DB, `src/pages/admin/applications/[id].astro`.
- New `applications.admin_notes` (TEXT, admin-only, never shown on any public route).
- Detail page gains a "Notes (only you see this)" section: textarea + Save button, POST
  `act=set_notes`, CSRF-protected. New `setApplicationNotes(db, id, notes)` in `db.ts`.

### 7. Admin display + Excel export surface everything
- **Detail** (`[id].astro`): People table shows relationship (label), a **Disabled** marker, a
  **Part-time** marker, and the new shoe/coat sizes; members whose relationship is in
  `NON_FAMILY_RELATIONSHIPS` get a quiet inline tag — "not part of the immediate family —
  please verify eligibility." Household section shows the parentage note when present. This is
  a review aid, never a block.
- **Members editor** (`[id]/members.astro`): relationship becomes the same dropdown (+ other
  text); add disabled, part-time, shoe, coat fields to both the edit and add-person forms.
- **Export** (`export.xlsx.ts` + `listApplicationsForExport` in `db.ts`): include relationship
  in the per-person `member_summary` string (e.g., `"Jane (Daughter, age 8)"`); add new columns
  "Parentage note" and "Your notes" (admin_notes). Disabled/part-time reflected in the person
  summary (e.g., append "· disabled", "· part-time").

### 8. "Apply to only one project" notice
- **File:** `apply.astro` intro area.
- Plain notice matching the paper form: "Please apply to only one holiday project in Grant
  County. Applicant names are shared among the county's projects, so applying in more than one
  place can hold up your gifts." (Operator to confirm the names-are-shared sentence is okay —
  it is a data-sharing disclosure.)

### 9. Gift request stays free-text + "no expensive items" note
- **File:** `MemberCard.astro`.
- **No fixed items list** anywhere in the form or code (inventory changes yearly with
  donations; the seasonal special-gifts list stays operator-editable content). Keep the
  existing per-person "Gifts or toys they'd like" textarea.
- Add helper text under it: "We can't provide expensive items like iPods, laptops, games, or
  TVs."

### 10. Fix the paper-application mailing instruction (address handling)
- **File:** `apply.astro` (both the open-form and closed-form states).
- The paper application is returned to the operator's personal address, which is preprinted on
  the form itself. Change "print the paper application and mail it to 245 W. Elm St." to:
  "print the paper application and mail it back to the address printed on the form."
- **Do not** display the operator's home address (807 E. Cherry St.) anywhere on the site.
- Keep 245 W. Elm St. everywhere else it appears (footer, contact, donate) — it is the general
  site/mailing address and is unchanged.

## Data model — new migration `migrations/0003_relationships.sql`

```sql
ALTER TABLE household_members ADD COLUMN relationship_other TEXT NOT NULL DEFAULT '';
ALTER TABLE household_members ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_members ADD COLUMN part_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_members ADD COLUMN shoe TEXT NOT NULL DEFAULT '';
ALTER TABLE household_members ADD COLUMN coat TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN parentage_note TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN admin_notes TEXT NOT NULL DEFAULT '';
```

- `household_members.relationship` (existing TEXT) now stores a canonical code for new rows;
  legacy rows keep their old value and render via `relationshipLabel`'s raw fallback.
- Existing 238 imported records: all new columns take their defaults (blank / 0). We cannot
  backfill relationships the old system never stored — those simply show blank, which is
  expected and acceptable.
- Apply this migration to the remote D1 (`gchp`) as part of go-live for this change.

## Type/interface changes (precise)

- `MemberClean` (validation) gains: `relationshipOther: string`, `disabled: boolean`,
  `partTime: boolean`, `shoe: string`, `coat: string`. `relationship` now holds a canonical
  code (or `other`).
- `MemberEdit` / `MemberInput` (db.ts) gain the same fields; `insertMember`, `updateMember`,
  `insertApplication` write them.
- `CleanApplication` gains `parentageNote: string`; `permanentlyDisabled` is now derived from
  members, not from `validateAbout`.
- `AboutClean` loses `permanentlyDisabled` (moved to derived assembly).
- `listApplicationsForExport` row shape / `getApplicationDetail` member shape gain the new
  columns.

## apply.js (progressive enhancement)

- No structural change needed: the "+ Add another person" clone copies the server-rendered
  `#member-template` (a `MemberCard` with `__N__`), so the new select/checkboxes/size inputs
  are included automatically, and `__N__` replacement covers their names/ids. Verify the added
  card's first control still receives focus (the query already selects `input, select,
  textarea`).

## Testing (TDD — write tests first)

- `validation/application.test.ts`:
  - relationship must be one of the allowed codes; `other` requires non-empty
    `relationship_other`; person-1 `self` accepted.
  - `disabled` / `part_time` parse from checkbox `on`/absent.
  - `shoe` / `coat` captured; blank-row skip updated to include the new fields.
  - `parentage_note` optional; over-length rejected.
  - derived `permanentlyDisabled` true iff any member disabled.
- `eligibility.test.ts`: `suggestHouseholdType` / `mayNotBeEligible` behave correctly given the
  derived disabled flag (disabled individual → `disabled`; senior head → `elderly`).
- `xlsx` / export: new headers present; member summary includes relationship label and
  disabled/part-time markers.
- db round-trip: insert application + members with new fields, read back via
  `getApplicationDetail`, values preserved.

## Out of scope (deferred, per operator)

- "Do you have a car? / who picks up your items?" pickup-logistics question.
- Elderly-vs-Family-vs-Disabled household-type checkbox on the applicant form (kept auto-derived).
- Structured Pay Forward (recipient name/town/phone + date). Current single free-text stays.
- No separate "Are you married?" field — the household relationship list answers it, matching
  the paper form.
- Converting `PROJECT APPLICATION.docx` to the downloadable `/application.pdf` and uploading to
  R2 is an operational task, not code. (Pending the operator confirming which page-2 revision is
  current.)

## Open items to confirm (non-blocking)

1. Relationship list: superset (this spec) vs. the shorter 4-option list.
2. The "applicant names are shared among projects" wording on the one-project notice.
3. Which paper-application page-2 revision is current (affects only the printed PDF, not this code).
