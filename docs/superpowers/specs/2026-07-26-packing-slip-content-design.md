# Packing Slip Content (Sherlyn's Document) — Design

Date: 2026-07-26. Source of truth: a document Sherlyn provided ("packing slip",
relayed by the owner: "she wants the packing slip to have that information on
it"). The document is a copy of the admin application-detail page's Household +
People sections.

## What this changes (and reverses)

Sherlyn's 2026-07-23 instruction removed gifts from the packing slip; her new
document explicitly includes **Gifts wanted** and **Doll** columns — having used
the system, she wants packers to see what to pack. This supersedes the July 23
slip-content decision. Her privacy line HOLDS: the document contains no income,
no good deed, no parentage note, no admin notes — those remain forbidden on
slips. Bags are absent from her document and remain off.

## The new slip = current content ∪ her document

Keep (already on the slip, not in her copy only because the detail page shows
them elsewhere): family name headline, PU #, people count, phone, address +
town, the automatic pickup date line, DIABETIC flag, bed choice/size.

Add (from her document):
- Header facts: Applied (Central date+time), Email, Household type,
  OK to share with a sponsor (Yes/No), Years received help, Adopted last year.
- People table gains columns: **Relationship** (via `relationshipLabel`,
  matching the detail page's wording), **Gifts wanted**, **Doll**
  (— / White doll / Non-White doll). Sizes now include **Shoe** and **Coat**
  (today's slip omits them; her document includes them).

Still forbidden on slips (privacy scan test updated accordingly): income
amounts/fields, good deed, parentage note, admin notes, bags, original_json.
`gifts` and `share_with_sponsor` come OFF the forbidden list — by Sherlyn's
explicit document.

Layout: keep the 3-per-page minimum (`min-height`, `break-inside: avoid`);
fuller slips grow taller and flow — never clipped. Plain print styling as today.

## Testing

Update `tests/slip-privacy.test.ts`: remove `gifts`/`share_with_sponsor` from
FORBIDDEN (add a comment citing this spec + date); keep all income/good-deed/
notes/bags tokens; test stays the guarantee for what still matters.
Build-verified rendering per house pattern.

## Out of scope

Income/good-deeds/notes on slips (never); bags (not in her document); any
change to the mailed-household exclusion or the packing-slip name.

## Addendum (2026-07-26, later the same day): no Bags section at all

Sherlyn, via the owner, on seeing the application page's Bags box ("Number of
bags / Save bags"): she does not want a bag section. Remove the feature end to
end: the detail-page section, the `set_bags` action and its banner,
`setBagsCount`, the bags history sentences (`describeBagsChange`), and the
`Bags` column in the backup export. The `applications.bags_count` column stays
in the database, inert (house pattern; dropping risks the deploy window for
zero gain). Packing slips already never showed bags; the slip-privacy scan
keeps forbidding `bags_count`.

## Addendum 2 (2026-07-26): one slip per page + handwriting notes area

Sherlyn, via the owner: "Each pick up slip should print out individually and
allow for me to put notes at bottom of slip." This supersedes the July
three-per-page preference (her expanded content made slips taller anyway).
- Each slip prints on its own page (`page-break-after: always` restored; the
  3.1in min-height goes — no longer meaningful).
- Each slip ends with a "Notes" label and five ruled blank lines for
  handwriting. Nothing stored, nothing printed from admin notes (those remain
  private and off-slip); it is blank paper space, by design.

## Addendum 4 (2026-07-30): gifts come OFF the slip — REVERSED by Addendum 5

Sherlyn, testing the live slips: "The pickup slips show gifts Please take
that off, we may not have what they ask for so we do replacements." The
"Gifts wanted" column is removed from SlipCard (six columns now); `gifts`
joins the slip-privacy FORBIDDEN list. The doll column STAYS — she stocks
the two doll choices, so it is not an "ask." Gifts remain visible on the
admin application page (she shops replacements from there).

## Addendum 5 (2026-07-31): the full slip story, resolved — gifts back on, pick up notices built

Sherlyn, updating her guidebook: "Why have packers slip then? Where is place
to print final form for packers to see items? ... So where can I print off
list that states actual gifts they are to pack? I wanted to add or delete
items." The 07-30 removal was a misunderstanding: her objection was to
packing the RAW family ask; what she wants is to EDIT each person's gifts to
the actual pack list (Edit household members → "Gifts / toys wanted") and
then print. So:

- **Gifts are BACK on the packing slip**, as the column "Gifts to pack" —
  the coordinator-curated list. `gifts` leaves the slip-privacy FORBIDDEN
  list (comment records the story). Seven columns again.
- **The mailed Pick Up Notice is BUILT** (this spec's Addendum 2, formerly
  parked; she supplied her paper form "Regular pickup slips.docx.pdf" and
  asked "You may have done this but I'm not seeing it"):
  `PickupNoticeCard.astro` copies her form faithfully — title, Name + ID#
  (pu_number), "Pick up: {day date_text + description}" (blank line when no
  day is matched), her three instruction paragraphs and the 245 West Elm St
  location text verbatim, three per letter page with dashed cut lines
  (page-break every 3rd, no dangling cut line). Route
  `/admin/applications/pickup-slips` mirrors the packing-slips page's view
  scoping (town/stragglers; mailed + adopted show notes); button "Print
  pickup slips to mail" sits next to Print packing slips. It travels in the
  mail, so it carries NO household data — pinned by
  tests/pickup-notice-privacy.test.ts (property-access tokens, since the
  location text contains the word "address").
- Terminology in the docs: PACKING slip (volunteers, at the site) vs PICK UP
  notice (mailed to the family) — the guide and manual §3 now define both.

## Addendum 3 (2026-07-26): the typed Packing note (built alone; pickup slips still held)

Sherlyn: "Is it possible that I could type the notes in before I print? They
complain about my penmanship." Owner approved building just this slice; the
mailed 3-up pickup slips remain designed-but-held.

- Migration `0014`: `applications.packing_note TEXT NOT NULL DEFAULT ''` (additive).
- Application page gains a **Packing note** box directly above "Your notes",
  labeled: "Prints on the packing slip — volunteers will see this." Textarea,
  client maxlength 1000, server `.slice(0, 1000)`, own CSRF'd `set_packing_note`
  action, banner "Packing note saved.", history row "Packing note was updated"
  (area `notes`, long-text style — no old/new values).
- Packing slip renders, when non-empty, "**Note for packers:** {packing_note}"
  (pre-wrap, ≥16px) directly above the ruled Notes lines. The ruled lines stay
  (last-minute pen notes still welcome).
- Backup export gains a "Packing note" column. Sherlyn's 11-column sheet is
  untouched.
- Privacy line unchanged: `admin_notes` ("Only you see this") still never
  prints anywhere; `packing_note` is volunteer-visible BY DESIGN and BY LABEL.
  The slip-privacy FORBIDDEN list is unchanged (no token collision; add a
  comment noting packing_note is deliberately allowed).
- Deploy: migrate-first (new code reads/writes the column).
