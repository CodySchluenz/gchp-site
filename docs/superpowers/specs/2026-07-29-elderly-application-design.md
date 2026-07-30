# The Elderly/Disabled Application — Design

Date: 2026-07-29. Status: approved by owner ("approve", after Sherlyn's step-back
statement of the requirement). Sources: Sherlyn's paper form (`elderly apps.pdf`),
her request document (`elderly request.pdf`), and her step-back message:
"check family or elderly/disabled household at top of application page... Once
they check elderly disabled it requests name address income questions about soc
sec ssi and other income for whom and add person and pay forward... It would
automatically give them the 2500 number and I could look at all applications
under that number and so I can send Christmas cards from that list."
Confirmed: elderly applicants DO use the website ("it's about 50 50").

## The shape

**`/apply` becomes the choice she sketched** — her paper world's two forms, online:

- `/apply` — the chooser. Two large, plain link-cards (JS-free; the honest way
  to do her "checkbox at the top" without conditional reveal, which the project
  forbids): **Family Household** — *children under 18* → `/apply/family`;
  **Elderly/Disabled Household** — *over 65, or receiving Social Security or
  SSI for a disability* → `/apply/elderly`. Below the cards: the existing
  phone-line + paper-application fallbacks, and both paper PDFs.
- `/apply/family` — the CURRENT full form, moved verbatim (imports/paths
  adjusted; behavior identical; still posts to itself; thank-you unchanged).
- `/apply/elderly` — the NEW short form (below).
- All three respect the closed gate exactly as `/apply` does today (same
  closed-message copy on the chooser; the two form pages show it too when
  reached directly).

## The short form (`/apply/elderly`) — her paper form, online

Field set (per the paper form + her step-back list; same warm register, 360px,
JS-optional, never wipes input, kind errors):

- About: first/last name, address, town (existing dropdown), phone (required),
  email (optional, with confirm — same rules as the family form's about block).
- **Which describes your household?** radio: "Someone here is 65 or older" →
  `household_type = 'elderly'` / "Someone here is permanently disabled and
  receives Social Security or SSI" → `'disabled'`. Required. (Her two programs
  route identically — 2500, mailed cards — but she sees the right word.)
- **People in your household** — name + age rows, "Add another person" exactly
  like the family form (elderly couples: "sometimes the household is a couple
  and both are elderly"). Person 1 = the applicant. Name + age required per
  listed row; no sizes, no gifts, no dolls, no relationship, no sex (stored as
  `''` — columns default; admin renders '—').
- **Income** (her paper form's block, reusing the existing validators):
  employers (name/worker/wage/hours, or the no-one-employed checkbox), Food
  Share amount, Social Security + for whom, SSI + for whom, child support +
  for whom, unemployment + for whom, other income + for whom. (The "for whom"
  answers are what her SSA/SSI disabled check reads.)
- Years received help. Pay-forward good deed (required, same as family).
- Deliberately NOT asked: bed (stored `'none'`), diabetic (0), sponsor consent
  (0 — adoption is a family-program concept; she can flip it in Edit details
  if ever needed), doll/sizes/gifts, parentage note, residence confirmation
  (stored 1 — not applicable). Her paper form's "county" and "how long at
  address" are also omitted: the town dropdown covers locality, matching the
  online family form's conventions.
- Validation: new `validateElderlyApplication` (TDD) composing the existing
  `validateBenefits`/`validateEmployment`/`validateGoodDeed` plus its own slim
  about/members/household-type sections. Submission uses `insertApplication`
  unchanged (snapshot, history "received" row, confirmation email — all free).

## What happens after (mostly already true)

- `household_type` elderly/disabled → approval auto-assigns the next **2500**
  number; excluded from packing; appears in the **"Elderly & disabled
  (mailed)"** view. (No new code — this is the existing block routing. Her
  "automatically give them the 2500 number" is satisfied by the type.)
- **Approval email branches**: household_type elderly/disabled →
  `renderElderlyApprovedEmail(firstName)`, body verbatim from her request doc:
  "You have been found eligible for the Grant County Holiday Project
  Elderly/Disabled program. Your gifts are a Christmas card containing a food
  and a gift card. You should receive the card the second week in December."
  Family households keep the current email. Subject in house style
  (no exclamation, org mid-sentence). Denial email unchanged for both.

## Christmas-card mailing labels

The mailed view gains **"Print mailing labels"** → `/admin/applications/labels`
(admin-only): Avery 5160 layout (3 columns × 10 rows, 1in × 2.625in, standard
sheet margins), one label per **approved, non-deleted, non-adopted** elderly/
disabled household in the season: name line ("First Last"), address line, city
line ("{City}, WI"). Season param convention; a Print button; a count line; a
plain note that zip codes print only if they were typed into the address.

## The grandfather finder (decision support)

A **family**-typed household containing a non-deleted member aged 65+ gets:
- a quiet badge on the applications list: `65+ in household` (gold, like the
  duplicate badge), via an EXISTS subquery flag on the list rows;
- a note card on the detail page above the decision buttons (duplicate-nudge
  register): "This family household includes {name}, age {age}. If they should
  receive their own Elderly/Disabled Christmas card instead, remove them under
  Edit people and enter a separate application for them."
Nothing automatic — she splits by hand, as she chose.

## The elderly paper application PDF

- Migration `0016`: `settings.elderly_pdf_uploaded_at TEXT` (additive).
- `/elderly-application.pdf` route mirroring `application.pdf.ts` (R2 key
  `elderly-application.pdf`, same fallback message).
- Admin **Paper application** screen gains a second upload block ("Elderly/
  Disabled paper application"), same one-button pattern, setting the new
  timestamp. Owner uploads her existing paper form after deploy.
- The chooser and `/apply/elderly` link it; `/apply/family` keeps the family
  PDF link.

## SEO / copy touches

`/apply` keeps its URL, title, and canonical (the chooser IS the apply page);
its meta description gains a clause about the two application types. The two
form pages get their own titles/descriptions (indexable, not in the sitemap —
the chooser is the entry; seo tests updated accordingly: the description-
presence list gains both files; INDEXABLE/sitemap unchanged).

## Privacy & non-negotiables (unchanged and re-asserted)

No eligibility automation — the type choice is the APPLICANT'S declaration and
Sherlyn's radio to correct; her children/SSA-SSI rules remain hand checks. All
three public pages JS-optional, 360px, WCAG AA, warm low-reading-level copy.
The labels page is admin-only. History/snapshot/email flows unchanged.

## Testing

TDD: `validateElderlyApplication` (required fields, member rows incl. add-rows
and blank-row skips, benefits/employment reuse, household-type radio, error
never-wipe contract via the values round-trip the family form uses);
`renderElderlyApprovedEmail` pinned verbatim; approval-email branching (pure
selection helper if extracted, else route build-verify + email-render tests);
list `has_elderly_member` flag (family-only, 65+ boundary at exactly 65,
soft-deleted members excluded); labels data selection (approved/mailed/
non-adopted/season); migration in harness; seo description test updated.
Screens build-verified per house pattern.

## Out of scope

Auto-splitting members across applications; conditional single-page form
(forbidden JS-free); Spanish (still a September ask-her); mailed 3-up family
pickup slips (still parked); any change to family-form content.

## Addendum (2026-07-30): Sherlyn's review feedback

Sherlyn, reviewing the live form: "There is no place to put added persons
income to show they are receiving ssa or SSI. There may be wife and disabled
son living with them that verifies their eligibility."

The place EXISTS — the Benefits section mirrors her paper form exactly
(Social Security / SSI amount + "Who receives it?", which is where a wife's
and a disabled son's benefits go). But the form's designer couldn't find it,
so applicants won't either. Fix is presentation, not data:

- People-in-your-household intro gains: "Each person's income, like Social
  Security or SSI, has its own place in the Benefits section further down."
- Benefits intro now says the questions cover everyone listed above, and
  spells out: total amount for the household + each receiving person's name
  under "Who receives it?" — "that's how we know who receives Social
  Security or SSI."

No schema or validator changes. (Follow-up, same day, on the owner's
"does the family form need this too?": its Benefits intro gained the same
covers-everyone clause — worded without "listed above", since that form's
Benefits section comes before its household section.)

Also in this round — blank-email decision buttons: email is optional on the
elderly form (and paper entry), so a blank address is now normal. The
Decision section's "Approve and email them" / "Deny and email them" buttons
hide when the application has no email (mirroring the Adoption section's
existing gate), a plain note explains why, "Approve without email" takes the
primary style so the screen keeps one obvious action, and the POST handler
treats an emailed decision with a blank address as a silent one (stale-tab
guard). Her question "where do I find the approval letter and Christmas card
email" is answered in the docs: guide + manual now quote the emails verbatim.
