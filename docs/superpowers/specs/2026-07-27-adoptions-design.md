# Adoptions — Design

Date: 2026-07-27. Status: approved by owner ("both columns. i approve this...
if you have a recommendation, just do that one and do it all").

## Why

Sherlyn adopts out ~50-60 approved families each season to community
organizations and adoptive families. Today that lives entirely in her paper
world. Her stated goal: succession — "when I can no longer do this job as
coordinator someone can pick it up fast through your website abilities."

## Owner-approved decisions

1. **Consent gate (hard, with a deliberate override path):** the Adoption
   section is active only on APPROVED applications where the family answered
   Yes to "OK to share with a sponsor" (`share_with_sponsor = 1`). Otherwise a
   plain note: "This family said No to sharing their needs — if they have
   since agreed, change that in Edit details first." Every step lands in
   History.
2. **Email text (owner approved the polish):** subject/greeting per house
   email style; body:
   "Per your approval, you have been adopted! You will not receive a pickup
   slip as stated in your approval notice. A community organization or
   adoptive family will contact you before December 10th to arrange a time
   and place for you to receive your gifts. Everything they receive about
   your family is kept confidential."
3. **Adopted families leave the packing flow:** excluded from packing-slip
   printing (all three sub-queries of `listApprovedForSlips` gain
   `AND adopted = 0`); their application page shows a note instead of the
   print button; the applications list shows a quiet "Adopted" tag. Pickup
   number stays (paper trail).
4. **Her spreadsheet — BOTH columns:** the existing `adopted` column keeps
   meaning adopted-LAST-year (the family's answer); a new **`Adopted by`**
   column (the adopter's name, blank unless adopted this season) is inserted
   directly after it. The backup export gains the full set: Adopted out
   (yes/''), Adopted by, Adopter contact, Adopter phone, Adopter address.
5. **Mailing address field included** (her letters purpose), optional.

## Data — migration `0015_adoptions.sql` (additive)

```sql
ALTER TABLE applications ADD COLUMN adopted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN adopter_name TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN adopter_contact TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN adopter_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN adopter_address TEXT NOT NULL DEFAULT '';
```

## Behavior

- **Application page — "Adoption" section** (below Cards given): when gated
  open — four fields (Adopted by [org or family], Contact person, Phone,
  Mailing address [optional]) + buttons **"Mark adopted and email them"** /
  **"Mark adopted without email"** (mirroring approve/deny; email requires a
  non-blank family email, else the with-email button is absent like the
  decision buttons' pattern — match whatever [id].astro does there). When
  already adopted: show the saved fields (editable, "Save adoption details")
  + **"Remove adoption mark"** (keeps the field values for re-marking).
  "Adopted by" is required to mark; the other fields optional.
- **History sentences** (pure, in history.ts, TDD):
  `describeAdoption('marked', name, mail)` → "Marked adopted by Platteville
  Kiwanis" (+ " — email sent" / " — email could not be sent" / ""),
  `('unmarked', ...)` → "Adoption mark removed",
  `('updated', ...)` → "Adoption details updated". Area `decision`.
- **Email:** `renderAdoptedEmail(firstName)` in the email lib, tested like
  the approve/deny renders, with the section-2 body verbatim.
- **Adoptions page** `/admin/adoptions` (AdminNav entry "Adoptions" after
  "Season summary"; AdminHome card "Adoptions — who has been adopted out,
  and by whom."): season-scoped printable table — Family, Town, Pickup #,
  Adopted by, Contact, Phone, Mailing address — count up top ("Adopted out
  this season: N"), season picker + Print button (house patterns). This is
  her next-year letters list.
- **Season summary:** Applications card gains, when N > 0:
  "Of the families served, adopted out: N." (a note line, NOT part of the
  by-town partition — the identity stays untouched).
- **db.ts:** `setAdoption(db, id, {adopterName, adopterContact, adopterPhone,
  adopterAddress})` (sets adopted=1 + fields), `clearAdoption(db, id)`
  (adopted=0, fields kept), `listAdoptions(db, seasonYear)` (adopted=1,
  non-deleted, ordered by adopter_name then id; returns the table's fields),
  `getSeasonSummary` gains `adopted` count (approved AND adopted=1),
  `listApplications` row gains `adopted` (for the list tag), ExportRow +
  export SELECT gain the five columns.

## Privacy

Adopter info is admin-only (plus the Adoptions printout she chooses to
print). Nothing adopter-related on packing slips (adopted families have no
packing slips at all) or public routes. The adoption email goes to the
family and contains no adopter details (she said contact happens adopter→
family).

## Testing

TDD: db round-trips (setAdoption/clearAdoption preserve-fields semantics,
listAdoptions ordering + season/soft-delete scoping, summary adopted count,
slips exclusion — an adopted approved family disappears from
listApprovedForSlips), history composer arms, email render (subject/body
pinned), export lockstep (sherlyn 12 columns now — header test updated;
backup + fixtures). Screens build-verified.

## Out of scope

Mailed 3-up family pickup slips (still parked); adopter accounts/portal
(never — Sherlyn is the only user); auto-matching families to adopters;
changing the approval email's pickup-slip sentence (the adoption email
corrects it, per her design).

## Addendum (2026-07-28): "Adopted" option in the Show-town dropdown

Owner request: filter the applications list for adopted families. The Show town
dropdown gains **Adopted** (after Stragglers): season's adopted families in
pickup-number order, flowing through everything that follows the view — the
Excel downloads and Print this list. The packing-slips page treats the Adopted
view like the Mailed view: a plain note ("Adopted households don't get packing
slips — the adopting organization or family provides their gifts."), since
adopted families are excluded from slips by design. Same `?N = 0 OR` bind
pattern as the mailed/straggler filters in both list and export queries.
