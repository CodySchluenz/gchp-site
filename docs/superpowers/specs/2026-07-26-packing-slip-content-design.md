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
