# Grant County Holiday Project - Website

## What this is
A volunteer-run charity site for Grant County, WI that provides food, gifts, and
clothing to families and elderly during the holidays. Serves 400+ families a season.
Seasonal: heaviest use October through December, quiet the rest of the year.

## Who this is for (read this first)
There are TWO non-technical human audiences, and both must be served excellently.
The technical choices exist to serve these two people; neither is optional.

1. The applicants: 400+ low-income families and elderly residents of Grant County who
   apply for holiday help each season. Many are not technical, some are elderly, some
   use old or cheap phones or shared/public (library) computers, and some cannot use a
   computer at all. Applying should feel easy, private, and dignified. The message phone
   line and the PDF application MUST remain as fallbacks for anyone who cannot or will
   not use the online form.

2. The operator: a ~70-year-old volunteer who is NOT technical and runs the program
   through the admin console each season. She must be able to use it confidently and
   independently, with no developer on the phone. A site with an admin she cannot
   operate is a failed project.

The owner/developer is technical but wants to be hands-off after launch.

## Goals, in priority order
1. Applicant experience. The family/elderly application must be effortless for non-technical
   people on old phones or public computers. See "Applicant experience" below.
2. Admin usability for the non-technical senior operator. See "Admin console" below.
3. Reliability and low maintenance. It has to "just work" every season with near-zero upkeep.
4. Security and privacy. The forms collect PII from low-income families. Handle it carefully.
5. Simplicity. Boring, well-supported tools and the fewest dependencies possible. Justify every package.

## Applicant experience (a critical surface)
Design the application flow for a possibly stressed, non-technical person, possibly
elderly, possibly on an old phone or a shared library computer:
- Mobile-first and lightweight. Works on small screens (test at 360px), slow connections,
  and old phones. The form still works with JavaScript disabled.
- No account, no login, no password to apply. One short form, doable in a single sitting.
- Ask only what the program truly needs. Every extra field loses applicants.
- Plain, warm, non-judgmental language at a low reading level. Generous spacing, large type
  and tap targets, WCAG 2.2 AA, keyboard and screen-reader friendly.
- Forgiving validation: kind, specific error messages, and never wipe what they already typed.
- Clear, reassuring confirmation after submit ("We received your application. Here is what
  happens next.") so an anxious applicant knows it worked.
- Dignity and privacy: state plainly that their information is private and used only for the
  program. This is sensitive PII.
- Keep the "pay it forward" good-deeds step simple and clearly explained; it is part of eligibility.
- Preserve and feature the fallbacks: the message phone line and the downloadable PDF
  application, for anyone who cannot or will not apply online. Do not bury them.
- OPEN QUESTION to confirm with the owner: is a Spanish version needed for this community?

## Admin console (a critical surface)
Design every admin screen for a non-technical 70-year-old operator:
- Large base font (18-20px minimum), high contrast, generous spacing and tap targets.
- Plain English only. No jargon. Say "Download list for Excel" not "Export CSV";
  "Applications this year" not "Records". Buttons carry text labels, never icon-only.
- One clear primary action per screen. An obvious "Back" on every screen. Impossible to get lost.
- Default to the CURRENT season automatically. She should never configure or filter to begin.
- Confirmation prompts before anything destructive, with undo where feasible. She cannot break it.
- Print-friendly views for applications, pickup lists, and the gifts list. Older users print; make it clean.
- A visible "Help" affordance on each screen with one or two plain sentences.
- Login must be dead simple for her (see auth below).
- Test it WITH her before launch (see working agreements).

## Visual design
- Continuity with the current site: light, bright, and Christmas/holiday themed. Longtime
  visitors should recognize it as the same beloved project, just modernized.
- Warm and festive, not garish. Light backgrounds with holiday red/green/gold as accents,
  not wall-to-wall color. Tasteful seasonal touches.
- Contrast must still meet WCAG 2.2 AA on the light theme. Never trade legibility for festivity.
- Performance first: no heavy animations, autoplay media, or huge images. Any decorative
  effect (falling snow, etc.) must be lightweight, optional, and harmless with JavaScript off.
- Keep and credit the Toys for Tots logo.
- The admin console prioritizes clarity over theme: a light festive touch is fine, but
  every screen in /admin stays plain, calm, and readable for the operator.

## Tech stack (default - confirm during brainstorming)
- Astro, static-first, for the public pages.
- Tailwind CSS for styling.
- Forms + admin: Astro server endpoints deployed as Cloudflare Pages Functions.
- Data: Cloudflare D1 (SQLite).
- Admin auth: optimize for HER, not the developer. Prefer passwordless magic-link login
  (she clicks a link in her email) with a long (about 30-day) session so she rarely logs in,
  via Cloudflare Access or equivalent. A username+password she must remember is a last resort.
  Whatever she can do unaided in a real test wins, as long as /admin is genuinely protected.
- Email notifications: Resend (free tier), or none if in-dashboard review is enough.
- Hosting/deploy: Cloudflare Pages via GitHub. main = production, pull requests = preview deploys.

## Non-negotiables
- Public pages work without JavaScript wherever possible; forms degrade gracefully.
- No third-party tracking or analytics that leak visitor data.
- Application data (names, addresses, household details) is sensitive:
  never log it in plaintext, never expose it on a public route,
  and support "download for Excel" plus purge of prior seasons for the admin.
- Mobile-first public site. Test at 360px width. The admin can assume a larger screen
  (she likely uses a laptop or desktop) but must stay large, legible, and simple.
- Keep the old PHP site live and untouched until the new site is verified and DNS is cut over.

## Yearly-changing content
News, the special gifts list, key dates, and the pickup schedule change every season.
DECISION NEEDED: does the operator edit these herself, or does the developer?
- If she edits them: build a small, plain "Update this year's info" screen in the admin
  that writes these fields to the database. No Markdown, no git, no code for her.
- If the developer edits them: keep them in Markdown in the repo (simpler build, but the
  developer is in the loop once or twice per season).
Do not assume she can edit Markdown or use git. She cannot.

## Live site access (discovery only)
The owner will provide admin login credentials for the CURRENT live site so the agent can
see the real admin UI and workflows exactly as the operator sees them. Rules:
- Read-only exploration. View pages and lists only. Never delete, edit, approve, purge,
  submit forms, or change any setting or data on the live site.
- Never write the credentials into any file, commit, log, or document. Use them in-session only.
- Save findings as plain descriptions and screenshots under docs/ or legacy/screenshots/,
  with any visible personal data redacted before anything is saved to the repo.
- The owner rotates the admin password after discovery is complete.

## Legacy code (reference only)
A read-only copy of the old PHP site lives in ./legacy. Read it to understand behavior;
never run it, and never carry its secrets or data forward.
- FIRST TASK: read legacy/adminPanel and legacy/application, combine that with the live
  admin UI (see "Live site access") and any screenshots in legacy/screenshots/, and produce
  a written inventory of every admin capability, the underlying data model, each operator
  workflow, and the applicant journey. Present that inventory for confirmation before
  designing the replacement.
- The legacy copy has been scrubbed of real credentials and real applicant PII.
  If you encounter any secret, connection string, or real personal data in it,
  stop and flag it rather than using it.
- The old code shows how things work TODAY. Whether to keep or simplify each behavior
  in the new system is a product decision to confirm with the owner, not a given.

## Content to carry over from the old PHP site
- Mission and history (30+ years; partnered with Tri-State Toys for Tots, Dubuque IA).
- Mailing address: 245 W. Elm St., Lancaster WI 53813.
  NOTE: the old site also showed "235 W. Elm St." in one spot. Confirm the correct number before launch.
- Contact: 608-723-2136 ext 1194 (message line only), skleinow@co.grant.wi.gov.
- Donation drop-off sites: Allegiant Oil, 190 N 2nd St Platteville (Mon-Fri 6a-6p)
  and 1486 Industrial Park Rd Lancaster (Mon-Fri 7a-5p). Cash: checks payable to the project.
- Key dates: donations accepted starting October 1; applications open October 1.
- "Pay it forward" eligibility requirement and the good-deeds form.
- Special gifts list (changes yearly).
- Pickup schedule.
- Toys for Tots credit + logo.
- Useful links: Grant County website; downloadable PDF application as a fallback to the online form.

## Pages
- Home: mission, key dates, donation summary, latest news.
- Donate: how to give (mail a check, drop-off sites, cash).
- Apply: the applicant experience described above, as an online form that writes to the
  database. Keep the PDF application and the message phone line as prominent fallbacks.
- Pickup schedule.
- Contact: form that emails and/or writes to the database.
- /admin (protected): the operator's workspace. List applications for the current season,
  view detail, mark processed, print, download for Excel, purge old seasons, and (if decided
  above) update this year's news, gifts list, and dates.

## Working agreements for the agent
- Build the admin console and the application flow EARLY, not last, and treat the usability
  of both as primary acceptance tests.
- Use test-driven development for anything with logic: form validation, endpoints, data handling.
- Run the build and the tests, and confirm they pass, before declaring any task done.
- Ask before adding a dependency or changing the stack.
- Prefer clear, commented, boring code. The next maintainer may be a student volunteer.
- Before launch, usability-test BOTH surfaces: watch the operator complete each admin task
  unaided, and watch a non-technical person complete the application on an old phone.
  Fix whatever confuses either of them.
