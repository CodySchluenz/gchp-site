# Product Decisions — answers to the legacy-inventory open questions

Answered by the owner on 2026-07-12. These supersede the corresponding "Open questions" in
`docs/legacy-inventory.md` (Section 9) and feed directly into the design phase.

## 1. Live admin access
Login credentials will **not** be provided. The admin UI is documented from the legacy code and
the screenshots in `legacy/screenshots/` (which cover every admin screen). Never store any
credential in this repo.

## 2. Mailing address
The correct street address is **235 W. Elm St., Lancaster WI 53813**. The PO Box (PO Box 447) is
also current, but the new site should show the **235** address. (The old site's "245" mentions
were wrong; CLAUDE.md has been corrected.)

## 3. Language
No Spanish version needed.

## 4. Roles
**Admin and Operator are the same person/role.** The site has exactly two kinds of users:
- **Admin** — the ~70-year-old volunteer who runs the program. Logins may be shared informally;
  this is acceptable for a small-town charity. No role hierarchy, no separate developer role.
- **Applicant** — no account, no login.
The admin edits all yearly content herself (news, special gifts list, key dates, pickup
schedule) through plain admin screens.

## 5. Eligibility rules
The new online form should **represent the paper application's rules**, including the rules the
old online form ignored (e.g., single/married individuals without children are not eligible
unless permanently disabled or over 65; county residency; years received help; adopted last
year — final field list to be settled in design, merged with decision 6).

## 6. Required fields (bare minimum)
- **Personal:** first name, last name, address, city, phone, email, **confirm email** (actually
  validated), diabetic flag, adopt-permission confirmation — all required.
- **Blanket/sheets:** keep the choice but present it in a friendlier format than radio buttons
  crammed in a table; **bed size is required**.
- **Employer information:** every field is **required** (legal/income-verification reasons). The
  employer list must be **dynamic** (add as many as needed), not hard-coded to 4 slots.
- **Benefits:** every benefits field is **required**, plus the full-time-residence confirmation.
- **Clothing needs:** redesign this step heavily, but keep collecting the same items per member:
  pants, shirt/top, underwear, socks, diapers (sizes) and gifts/toys wanted.

## 7. Emails
- On submit: the applicant receives an **immediate confirmation email** that their application
  was received.
- On review: the admin has a **button to send an approve or deny email** after manual review
  (deny now gets an email too, unlike the old site).

## 8. Household members
The form captures **adults and children uniformly** (same member sub-form for everyone),
as the old data effectively did.

## 9. Donations
- **Record donations** (the old `donations` table was unused — the new system should actually
  track them) **and** keep the donor directory.
- Keep the **PayPal donate button**; the receiving PayPal account is
  **"Grant County Holiday Project"**.

## 10. Data retention and export
- Keep applicant data **indefinitely** — volume is tiny (< 1M rows ever). This supersedes the
  earlier "purge prior seasons" assumption; season close-out must NOT require deletion.
- The admin can **update and delete** individual applicant records.
- The admin can **export** the data ("Download for Excel").

## 11. "Permission to adopt" meaning
A community member ("adopter") sponsors/funds the family's needs. **The charity keeps the
family's identity secret from the adopter** — the adopter only learns what the household needs.
The form wording should explain this plainly (e.g., "A generous neighbor may sponsor your
family's gifts. They will never be told your name — only what your family needs.").

## 12. Pickup slips
PU# and bag counts are filled in **by hand** today; the new system should **assign and track
pickup-slip numbers** (and ideally bag counts) instead.

---

## Engineering policy decisions (recorded during Plan 2 final review, 2026-07-13)

- **Apostrophes in code-authored copy:** standardize on straight apostrophes (') everywhere —
  greppable, keyboard-typable, and consistent with what the operator will type into content
  fields. The validation messages currently carry typographic apostrophes (’); sweep them to
  straight in Plan 3. No more per-string fix cycles.
- **Orphaned-application protection:** `insertApplication` compensates a failed child batch by
  deleting the parent row (commit 408a4f3) — an application can no longer exist with zero
  members. Recorded so Plan 3's admin screens may assume every application has members.
- **Plan 3 binding notes (carried from Plan 2 reviews):** upgrade the test harness to apply all
  of `migrations/*.sql` when the first new migration lands (the `split(';')` splitter must be
  hardened then too); add a test for sendEmail's 300-char truncation when admin screens display
  the error text; simplify the apply POST block (drop the unreachable spam branch, merge
  duplicate imports) in any commit touching it; `household_members`/`employers` lack
  `deleted_at` — the admin delete workflow gates children via the parent; consider surfacing
  send-failure health to the admin.
- **Apply rate limit (RESOLVED by owner 2026-07-13):** bumped from 5 to **10 valid submissions
  per hour per IP** — shared library computers put many applying families behind one address.
- **Holiday header graphic (owner request 2026-07-13):** keep the original site's Santa banner
  ("it keeps the small town vibes"). The legacy `header.png` (981KB) is recompressed to ~121KB
  and serves as the site masthead/logo with its baked-in wording carried by alt text (WCAG
  logotype exception). Plan 3 note: consider a calm, small version of the legacy admin Santa
  banner for the admin header (admin stays plain per spec).

## Plan 3b binding notes (carried from Plan 3a whole-branch review, 2026-07-13)

Do these in Plan 3b (admin content/pickup/donors/messages/PDF upload):
- **Magic-link verify interstitial + atomic token consume — do this BEFORE the first real login
  test with the operator.** Her county mailbox (@co.grant.wi.gov) likely runs link scanners
  (Defender Safe Links) that GET URLs at delivery, which would consume her single-use sign-in
  token before she clicks. Change `/admin/verify` so GET renders a one-button "Sign me in" form
  and POST consumes the token; fold in an atomic `UPDATE login_tokens SET used_at=? WHERE
  token_hash=? AND used_at IS NULL` (also closes the read-then-write token/session race).
- **Excel export columns:** spec §5 lists more columns than Plan 3a's export ships (years received,
  adopted last year, bed choice/size, benefit amounts, employment summary, member count). Either
  extend the export (cheap — already one GROUP_CONCAT query) or the owner confirms the trimmed set
  is fine. Also: the list page's "Download for Excel" link carries `q=` but the endpoint ignores
  it — either honor the name filter or drop `q` from the href.
- **PRG on approve/deny:** the detail-page approve/deny POST re-renders without a redirect, so a
  refresh re-sends the applicant email. Redirect (303) to the detail page with a `?done=` banner.
- **Undo/restore confirmation banner:** after restore, redirect with `?restored=1` and a plain
  "It's back in your list." message.
- **CSRF-failure + light-validation feedback:** admin edit/detail POSTs silently discard on a stale
  CSRF token; the edit form has no required checks (blank first name saves ''); `set_bags` coerces
  garbage to 0. Add gentle "that didn't save — please try again" / "please type a number" banners.
- **PU# assignment race:** `assignPuNumber` is read-then-write; make it a single statement in 3b.
- **Apostrophe sweep:** `src/lib/validation/application.ts` still has typographic apostrophes (’);
  sweep to straight per the standing typography decision above.
- **README admin dev-note option 1** (read the magic link from the dev log) isn't followable —
  the link is never logged and only the token hash is stored. Rewrite around the session-row method.
- **Accepted risk (record, no fix):** the admin name-search puts applicant surnames in the URL
  (`?q=Smith`) — operator-typed, gated route, low sensitivity, but it lands in her browser history.

## Plan 3c binding notes (carried from Plan 3b whole-branch review, 2026-07-13)

Plan 3b delivered: magic-link verify interstitial + atomic token consume, applications-open
toggle, news/gifts + pickup editors (add/edit/reorder/soft-delete+undo), paper-application PDF
upload to R2, apostrophe sweep, README dev-login fix. The whole-branch review found one Important
issue — an unvalidated `?undo=` param interpolated into a CSRF-armed form action could retarget
the Undo POST to the new applications-open toggle — fixed in Plan 3b (commit 46eacc5) by requiring
`undoId` to be all digits in the content/pickup/applications index pages.

Carried forward to Plan 3c (still deferred from Plan 3a's notes, plus new ones):
- **PRG on approve/deny** (detail-page POST re-renders; refresh re-sends the applicant email).
- **PRG on content/pickup add/update/move:** these render the banner on the POST response with no
  redirect, so a browser refresh can duplicate an "Add." Same fix class as approve/deny PRG.
- **Undo/restore confirmation banner** (redirect with `?restored=1` + "It's back in your list.").
- **CSRF-failure + light-validation feedback banners** (edit/detail POSTs silently discard on stale
  CSRF; blank first name saves ''; `set_bags` coerces garbage to 0; empty-date on pickup day update).
- **PU# assignment race** (`assignPuNumber` read-then-write → single statement).
- **LIKE-wildcard escaping** in the admin name search (`%`/`_` unescaped).
- **Fuller Excel export columns** (years received, adopted last year, bed choice/size, benefit
  amounts, employment summary, member count) and honor `q` in the export href (or drop it).
- **Paper-application PDF cache:** `/application.pdf` serves `Cache-Control: public, max-age=300`,
  so after an upload the "now published" banner + "View it" link can show the old PDF for up to 5
  minutes. Either drop the caching on that route or soften the post-upload banner wording.
- Plus the originally-deferred 3c scope: donors/donations recording, contact-messages admin screen,
  and member/employer/benefit-level application editing.

## Still open (owner actions, not design questions)
- Rotate the live admin password and the MySQL password (both were exposed in the original repo
  contents, and the admin password also appeared in chat).
- Decide how to handle `legacy/public_html/adminPanel/upload/gchpManual.pdf`, which prints a
  stale 2014 admin username/password on page 4 (remove, or replace with a redacted copy) — it is
  also publicly downloadable on the live site.
