# Legacy Site Inventory — Grant County Holiday Project

**Purpose:** A written inventory of the current (old) PHP site: every admin capability, the
data model, each operator workflow, and the applicant journey. This is discovery only. It
describes how things work **today**. Whether to keep, simplify, or retire each behavior is a
product decision to confirm with the owner (see Section 8) before any replacement is designed.

**Sources used:** the legacy PHP code under `legacy/public_html` (with most attention on
`adminPanel/` and `application/`), the database dump `legacy/schema.sql` (structure only —
applicant data and credentials were removed during discovery; see the note at the end of this
document), the screenshots in `legacy/screenshots/`, the operator user manual
(`legacy/public_html/adminPanel/upload/gchpManual.pdf`, written by the 2014 student team), and
the printable PDF application (`legacy/public_html/PDFapplication.pdf`).

**Live admin access:** The owner has decided **not** to provide live credentials, so this
inventory is derived from the code plus the saved screenshots (which show every real live admin
screen). Anywhere the live UI would settle a remaining detail, it is called out as "verify on
live" — the owner can answer those by looking, without agent access. Sections 1–3 and 5 are
written in plain language for validation with the operator.

---

## Section 1 — Admin capabilities

Every distinct action the admin panel supports. Each entry lists what it does, the data it reads
or writes, and any conditions. All admin pages sit under `legacy/public_html/adminPanel/`.

**Access condition for everything below:** the user must be logged in. Each page re-checks the
login by looking for a "valid_user" marker in the browser session; if it is missing the page
tries to bounce back to the login screen. (Two pages have this check switched off — see the
security notes in Section 6 and 8.)

1. **Log in.** `adminPanel/login.php`. The operator types a username and password. The code runs
   `SELECT COUNT(*) FROM admin WHERE UserName = ? AND Password = ?`. If a matching row exists, it
   stores the username and password in the session and shows the admin home. Reads: `admin`
   table. Note: passwords are stored and compared in **plain text**.

2. **Log out.** `adminPanel/logout.php`. Destroys the session and returns to the login form.

3. **View admin home.** `adminPanel/admin.php`. Landing page after login. Shows the top menu
   (Admin Home, Donors, Applicants, Sidebar, Pickup Schedule, Logout) and two links: "Upload PDF
   Application" and "User Guide" (opens `upload/gchpManual.pdf`). Reads: nothing from the DB.

4. **Upload / replace the PDF application.** `adminPanel/upload.php` (opens in a small popup
   window). Lets the operator upload a `.pdf` or `.doc` up to ~2 MB into the `upload/` folder.
   This is how the downloadable paper application gets refreshed. Writes: a file on disk (not the
   database). Note: the uploaded file is saved under its original name, so it does not reliably
   overwrite the file the public site links to (`/PDFapplication.pdf` at the site root) — see
   Section 6.

5. **View all applicants (current season).** `adminPanel/applicants/applicants.php`. Shows a
   table of every applicant with Reviewed (checkbox), Last Name, First Name, City, Date of
   Application, Approved (checkbox), and an Edit button per row. Reads: `applicants` joined to
   `cities`. There is no season filter — the list is simply "everyone currently in the table"
   (the table holds one season at a time; see Section 7).

6. **Open / edit one applicant.** Clicking **Edit** re-opens the full application inside the admin
   using the same five form sections the applicant filled in, pre-filled with saved values:
   personal details, employers/income, benefits, each household member's clothing sizes and
   gifts, and the good deed. Reads: `applicants`, `appEmp`, `benefits`, `children`, `goodDeed`
   for that applicant. (Technical note: this detail view only appears if the applicant has at
   least one child row and one employer row, because of how the underlying query is written — see
   Section 6.)

7. **Save applicant edits.** The **Update** button. Writes the edited values back to
   `applicants`, `appEmp` (employers 1–4), `benefits`, `children` (each member), and `goodDeed`.

8. **Approve an applicant.** The **Approve** button. Sets `approved = 1` and `reviewed = 1` on the
   applicant. If the applicant gave a valid email, it sends them an email: subject "Grant County
   Holiday Project Application", body "Your Application … has been Approved", from
   `skleinow@co.grant.wi.gov`. Then shows a confirmation and, after a built-in **10-second delay**,
   returns to the applicant list. Writes: `applicants`. Side effect: one email.

9. **Deny an applicant.** The **Deny** button. Sets `approved = 0` and `reviewed = 1`. No email is
   sent on deny. Writes: `applicants`.

10. **Add a household member (child) to an applicant.** The **Add Child** button opens a small
    form; **Add** inserts a new member (name, sex, age, clothing sizes, gift) for that applicant.
    Writes: `children`.

11. **Delete a household member.** The **DELETE Member N** button removes that one member. Writes:
    deletes a row from `children`.

12. **Delete an employer.** **DELETE Employer 1–4** blanks out that employer's name, wage, and
    hours for the applicant. Writes: `appEmp` (sets fields to null).

13. **Delete a single applicant.** The **DELETE Applicant** button removes that applicant
    everywhere: their row in `applicants` plus all related rows in `appEmp`, `benefits`,
    `children`, and `goodDeed`. There is **no confirmation prompt** on this button. Writes:
    deletes from five tables.

14. **Delete ALL applicants (season purge).** The **DELETE ALL APPLICANTS** button at the bottom
    of the applicant list. Shows a simple "Are you sure?" Yes/No, then **empties** the entire
    `applicants`, `appEmp`, `benefits`, `children`, and `goodDeed` tables. This is the yearly
    close-out / wipe. It is all-or-nothing: there is no "purge seasons older than X." Writes:
    truncates five tables.

15. **Generate Household slip (printable packing / pickup slip).** The **Generate Household**
    button produces a **Microsoft Word (.doc)** download named `app_Members.doc` containing the
    household summary: a PU# and #Bags line (blank, to be written in by hand), name, phone,
    number in household, address + city + zip, and a table of each member's name/sex/age/clothing
    sizes/gifts, plus bed type/size, permission-to-adopt, and diabetic flags. Reads: `cities` (to
    resolve the city name/zip) plus the applicant data posted from the edit screen. This Word
    download is the legacy site's only "print this applicant" mechanism.

16. **View all donors.** `adminPanel/donor/index.php`. Lists donors with Full Name, Contact,
    Address, City, State, Zip, Phone, Email, and Delete/Edit buttons. Reads: `donor`.

17. **Search donors by name.** A "Search by Name" dropdown; choosing a name shows that donor,
    choosing "ALL" shows everyone. Reads: `donor`.

18. **Add a donor.** "Add New Donor" link → new-donor form → **Add**. Writes: `donor`.

19. **Edit a donor.** The **Edit** button on a donor row → edit form → save. Writes: `donor`.

20. **Delete a donor.** The **Delete** button on a donor row. No confirmation prompt. Writes:
    deletes from `donor`.

21. **View sidebar / "Latest News" content.** `adminPanel/sidebar/index.php`. Lists the homepage
    sidebar content blocks (Title, Subtitle, Paragraph) with Delete/Edit. These blocks are what
    appear under "Latest News" on the public homepage — in the current data they are "2025 Info /
    Pick up times", "Special Gifts List", and "Applications". Reads: `bar`.

22. **Add a sidebar block.** "Add a new item to sidebar" → form → save. Writes: `bar`. (The form
    asks the operator to supply the block's ID number, which is fragile — see Section 6.)

23. **Edit a sidebar block.** **Edit** → change Title/Subtitle/Paragraph → save. Writes: `bar`.

24. **Delete a sidebar block.** **Delete**. Removes the whole block immediately, no confirmation.
    Writes: deletes from `bar`.

25. **Edit the pickup schedule.** `adminPanel/pickup/index.php` → "Update the Pickup schedule".
    Presents a fixed form of ~23 text boxes: a table title, an intro paragraph, ten date/
    description row pairs, and a footer line. **Update** saves them. Reads/writes: `pickup` (23
    numbered text rows). The public pickup page renders these same 23 rows into a fixed table
    layout.

**Capabilities that CLAUDE.md expects but the legacy admin does NOT have:** a "Download list for
Excel"/CSV export (the only export is the per-applicant Word slip in #15); any print-friendly
HTML view (printing today means printing the Word slip or the browser page); a per-season filter
or multi-season history (the table holds one season and is wiped); undo on any delete; and any
in-admin editing of the homepage mission text, key dates, or Toys-for-Tots content (those live in
page HTML, not the database).

---

## Section 2 — Operator workflows (plain language)

How a volunteer actually uses the system across a season. Written so a non-technical person can
confirm each step.

### Workflow A — Start of season / getting in
1. Go to the public homepage and scroll to the very bottom; click the small "Admin" (or
   "Administration") link.
2. On the login screen, type the username and password and click **Log In**.
3. You land on the Admin Home page with the top menu: Admin Home, Donors, Applicants, Sidebar,
   Pickup Schedule, Logout.

### Workflow B — Update this year's news, special gifts list, and "applications open" note
1. Click **Sidebar** in the top menu.
2. You see the content blocks that show on the homepage under "Latest News" (for example "2025
   Info", "Special Gifts List", "Applications").
3. Click **Edit** on a block, change the Title, Subtitle, or Paragraph text, and save.
4. To add a brand-new block use "Add a new item to sidebar"; to remove one use **Delete** (it is
   removed immediately, so be sure).

### Workflow C — Update the pickup schedule
1. Click **Pickup Schedule**, then "Update the Pickup schedule".
2. You get a page of text boxes: a title, an intro paragraph, ten pairs of Date + Description
   (the pickup days and which towns/times), and a footer note.
3. Click inside any box, edit the text, and click **Update** at the bottom right. Changes show on
   the public pickup page right away.

### Workflow D — Replace the downloadable paper application
1. From Admin Home, click "Upload PDF Application" (a small window opens).
2. Choose the new PDF (or Word) file and click **Upload**.
   (Caveat to verify on the live site: because of how the upload is named/stored, the public
   "PDF Application" link may still point at the old file — see Section 6.)

### Workflow E — Review and decide on applications (the core seasonal loop)
1. Click **Applicants**. You see everyone who has applied, newest work sorted by hand, with
   Reviewed and Approved checkboxes and an **Edit** button per person.
2. Click **Edit** on a person to open their full application: name/address/phone/email, blanket
   or sheets choice, employers and income, benefits, each household member with clothing sizes
   and wanted gifts, and their good deed.
3. Correct anything that needs fixing (people often mistype), then:
   - Click **Update** to save changes, or
   - Click **Approve** to accept them (this also emails the applicant if they gave an email), or
   - Click **Deny** to decline them (no email).
4. If the household is missing a member, use **Add Child** to add one; use **DELETE Member** or
   **DELETE Employer** to remove entries; use **DELETE Applicant** to remove the whole person.
5. After **Approve**/**Deny** the page pauses about ten seconds and then returns to the list.

### Workflow F — Produce the packing / pickup slip for a household
1. Open a person with **Edit** (Workflow E).
2. Click **Generate Household**. A Word document downloads with the household summary and a blank
   PU# and #Bags line.
3. Open/print that Word file; it is used by packers and for pickup. (Filling in PU# and bag count
   is done by hand.)

### Workflow G — Manage donors
1. Click **Donors**. You see all donors, with a "Search by Name" dropdown and Add/Edit/Delete.
2. Use "Add New Donor" to record a new donor, **Edit** to change one, **Delete** to remove one.
   (There is a separate, public-facing donor form on the Donate page as well — see Section 5.)

### Workflow H — Close out the season
1. When the season is over, from the **Applicants** list click **DELETE ALL APPLICANTS**.
2. Confirm **Yes**. This erases every applicant and all their household/employer/benefit/good-deed
   data. Nothing is archived. (There is no per-year retention; the table is meant to be empty
   before the next season starts.)

**Not currently possible in the admin (confirm these are true gaps to fix):** downloading the
applicant list as a spreadsheet; a clean print view of the list or of one application; keeping
last year's data while starting a new year; undoing an accidental delete.

---

## Section 3 — Applicant journey (plain language)

The full path a family or elderly resident takes, from landing on the site to confirmation, with
every decision point, required field, the pay-it-forward step, and the fallbacks. Flags for what
would confuse or lose a non-technical or elderly applicant are marked **[Risk]**.

### Landing and choosing how to apply
1. The applicant reaches the homepage. Under "Latest News" they see this year's info, the special
   gifts list, and a note that applications open **October 1** and that non-computer users can
   call **608-723-2136 ext 1194** (a message line) to request a paper application.
2. They click **Application** in the top menu. The application page explains there are **5 steps**,
   that they should use the form's own Back/Cancel buttons (not the browser back button), and
   that they can instead **download the PDF application** and mail it in. It also says to enter an
   email to be notified if they are accepted or denied.
   - **Fallback 1 (PDF):** a "pdf application" link to download and mail. **[Risk]** it is a
     small inline link, easy to miss; and mailing requires the correct address, which the site
     currently states inconsistently (see Section 6).
   - **Fallback 2 (phone):** the message line, mentioned in the sidebar text, not on the form
     itself. **[Risk]** an anxious applicant on the form may not see it.

### Step 1 — Personal information
Required: **First Name, Last Name, Address, City (dropdown), Phone.** Optional: **Email** and
**Confirm Email**, a diabetic-in-household checkbox, a "permission to adopt my family to other
organizations (confidential)" checkbox, and a blanket-or-sheets choice with a size.
- City is a dropdown limited to Grant County towns; a banner says "You must be a resident of
  Grant County Wisconsin."
- **[Risk]** validation is done with pop-up alert boxes ("Please fill in the first Name field"),
  one field at a time. On old phones/screen readers these alerts are easy to miss and slow.
- **[Risk]** "Confirm Email" is collected but is **not actually checked against the first email**,
  and only the first email is saved — a mismatch is silently ignored, so approval emails can go to
  a mistyped address.
- **[Risk]** the "tree"/"permission to adopt" wording is confusing and the field is oddly named
  internally; the meaning ("may we share your family with other charities") should be stated
  plainly.
- **[Risk]** a strong warning tells users not to use the browser back button or close the
  browser, because progress is held in a temporary session; closing loses everything. This is
  fragile for stressed or interrupted users.

### Step 2 — Employer / household income
Up to **four** employers, each with employer name, hourly wage, and hours per week. All optional —
the page says to leave it blank if no one is employed.
- Validation: if you fill an employer name you must also fill its wage and hours, or you get an
  alert. **[Risk]** wage/hours as free text invites formatting errors.

### Step 3 — Benefits and household size
Monthly amounts for Food Share, Social Security, SSI, W2, Child Support, and Other Income (all
optional; blank counts as 0). Then a required **number of household members** (1–15), "including
yourself," with a note that listed children must live at the residence full-time.

### Step 4 — Each member's clothing and gifts
The form repeats once per member chosen in Step 3. For each: **first and last name (required),
sex (required), age,** clothing **sizes** (pants, shirt/top, underwear, socks, diapers), and a
free-text **gifts or toys wanted** box.
- **[Risk]** for a large household this is a long, repetitive form on a phone; there is no save/
  resume.

### Step 5 — Pay-it-forward good deed (eligibility requirement)
A required **good deed** text box. The page explains the Pay-It-Forward requirement: to receive
gifts you must give something of yourself in the community (examples given), that helping family
members or paid work does not count, and to tell recipients it is part of the Holiday Project.
- This single good-deed text is the entire online pay-it-forward step. (The paper process also
  references a separate "Caring and Giving Report" form.)
- **[Risk]** wording is dense and slightly judgmental in tone ("doesn't meet Pay Forward
  requirements"); should be warmer and lower reading level.

### Submit and confirmation
On **Finish**, the site writes the whole application to the database (personal, employers,
benefits, each member, good deed) and shows: **"Your application has been successfully submitted.
Thank You."**
- **[Risk]** the confirmation is a single plain line with no "what happens next," no reference
  number, and no restatement that their info is private. An anxious applicant gets little
  reassurance.
- **[Risk]** nothing on the applicant side states a privacy/confidentiality promise at the point
  of data entry.
- There is **no immediate confirmation email** to the applicant; email only happens later, if/when
  the operator clicks Approve or Deny.

### Eligibility rules seen in the paper form (confirm they still apply online)
The PDF application states: must list all household members and income; **single or married
individuals without children are not eligible unless permanently disabled or over age 65**; asks
how many years they have received help and whether they were "adopted" last year. The online form
does **not** enforce or even ask several of these (e.g., the disabled/over-65 rule, years
received, adopted-last-year). Confirm which rules must be represented in the new online flow.

---

## Section 4 — Data model

### Which databases exist
The dump contains **three** MySQL databases:

- **`grantco3_holidayProject`** — the **live/production** database. All current site code connects
  here (`includes/dbConnect.php`, `includes/databasesetup.php`). **This is the one to migrate.**
- **`grantco3_hproject`** — an older schema variant (tables named `appben`, `deed`, `donator`,
  `citycode`, `sidebar`, etc.). Not referenced by any live code.
- **`grantco3_testing`** — a test copy, same style as `hproject`. Not referenced by any live code.

**Recommendation:** migrate only `grantco3_holidayProject`. Treat the other two as dead
developer leftovers — do **not** carry them to D1 (confirm in Section 9).

### Live tables (`grantco3_holidayProject`)
Storage engine MyISAM, charset latin1 (both should become standard SQLite/UTF-8 in D1). "PII"
marks fields holding personal information about applicants or donors.

**`applicants`** — one row per online application (household head).
| Field | Type | Notes |
|---|---|---|
| `appID` | int, PK, auto-increment | links all household tables |
| `fName` | varchar(50) | **PII** first name |
| `lName` | varchar(50) | **PII** last name |
| `address` | varchar(100) | **PII** street address |
| `cityID` | int | FK → `cities.cityID` |
| `tree` | tinyint | "permission to adopt out to other orgs" flag (0/1) — misleading column name |
| `diabetic` | tinyint | someone in household is diabetic (0/1) — **PII (health)** |
| `phone` | varchar(20) | **PII** phone |
| `email` | varchar(50) | **PII** email |
| `date` | varchar(10) | application date stored as text `YYYY/M/D` (not a real date type) |
| `approved` | varchar(11), default '0' | '1' approved / '0' not; stored as text |
| `reviewed` | varchar(11), default '0' | '1' reviewed; stored as text |
| `bedType` | varchar(10) | "sheet" or "blanket" |
| `bedSize` | varchar(10) | twin/full/queen/king |

**`appEmp`** — one row per applicant, up to four employers inline. **PII (financial).**
`appID` (FK), plus `employer1..4` (varchar), `wage1..4` (decimal), `hrsPerWk1..4` (int). There is
also an `appEmpID` auto-increment key in the indexes.

**`benefits`** — one row per applicant. **PII (financial).**
`appID` (FK), `fsAmount` (food share), `ssiAmount`, `w2Amount`, `csAmount` (child support),
`omAmount` (other monthly), `socAmount` (social security) — all decimal. A `benID` auto-increment
key exists in the indexes.

**`children`** — one row per household member (not only children). **PII.**
`childID` (PK, auto-increment), `appID` (FK), `name` (varchar 50), `sex` (char 1), `age` (int),
`pantSize`, `shirtSize`, `undSize`, `sockSize`, `diaperSize` (varchar), `gift` (varchar 255).

**`goodDeed`** — one row per applicant. `appID` (FK), `deedText` (varchar 100). The pay-it-forward
text.

**`cities`** — lookup of Grant County towns. `cityID` (PK), `cityName` (varchar 50), `cityZip`
(char 5). 24 towns (Bagley → Woodman + Prairie du Chien). Not PII; safe reference data (retained
in the scrubbed dump). Note gap: the ID sequence skips 21 (no city 21).

**`donor`** — donor directory. **PII (donor contact).** `donID` (PK, auto-increment), `donName`,
`donContact`, `address`, `city`, `state` (char 2), `zip` (char 5), `phone`, `email`. Screenshot
shows the live table has test/junk rows ("buspar", "gh/fgf") mixed with real donors.

**`bar`** — homepage "Latest News" sidebar blocks. `sbID` (PK), `title`, `subtitle`, `para`
(all text). Not PII; this holds yearly-changing news + the special gifts list (retained in the
scrubbed dump).

**`pickup`** — the pickup-schedule content. `ParaNum` (int, 1–23), `ParaText` (text). Not PII;
holds the current pickup schedule (retained in the scrubbed dump).

**`admin`** — login accounts. `username` (varchar 50), `password` (varchar 50) — **plain text.**
One account. (Row data removed during discovery.)

**`donations`** — `donationID`, `donID`, `itemDon`, `monDon` (decimal), `date`. Defined but
**no live code reads or writes it** — appears unused/aspirational.

### Relationships
`applicants.appID` is the hub. `appEmp`, `benefits`, `children`, `goodDeed` each reference `appID`
(one applicant → one employer row, one benefits row, one good-deed row, many children rows).
`applicants.cityID` → `cities.cityID`. `donor` and `bar` and `pickup` stand alone. Note: these
relationships are **by convention only** — MyISAM has no enforced foreign keys, so orphan rows are
possible (and deletes are done by hand across all five tables).

### How many seasons of data exist
Effectively **one**. Because "DELETE ALL APPLICANTS" truncates the applicant tables at close-out,
the live database holds only the **current** season. The dump's counters indicate roughly the
2025 season size: applicants counter ≈ 259 (~258 online applications, consistent with "400+
families" where many apply on paper), children counter ≈ 911, donors ≈ 30, sidebar blocks up to
id 53 (3 active). The dates in the applicant sample were all 2025 (Aug–Oct). **There is no
historical applicant archive to migrate** — only the current season plus the reference/content
tables (`cities`, `bar`, `pickup`, `donor`).

### Mapping to D1 (SQLite)
- Migrate `grantco3_holidayProject` only. Skip `grantco3_hproject` and `grantco3_testing`.
- Collapse the "wide" tables into cleaner shapes: `appEmp` (employer1..4) → a proper `employers`
  child table (0..n rows); `benefits` inline amounts → either columns or a tidy `benefits` table;
  `children` → `household_members` (rename; it is all members, not just kids).
- Replace text flags with real types: `date` → ISO date; `approved`/`reviewed` → integer/boolean
  or a single `status` enum (new / reviewed / approved / denied); `tree` → a clearly named
  `share_with_other_orgs` boolean.
- Add a real **season/year** column so multiple seasons can coexist and "purge old seasons" can be
  a filter instead of a full wipe (this is a CLAUDE.md requirement the legacy lacks).
- `cities` → seed table (carry the 24 towns + zips). `bar` → the editable "this year's info /
  news / special gifts" content. `pickup` → editable pickup schedule (model as rows, not 23 fixed
  fields). `donor` → donors (clean out the test rows during migration).
- Drop `donations` unless the owner wants donation tracking (it is unused today).
- Do **not** migrate the `admin` table's approach (plain-text passwords). Replace with the
  passwordless magic-link auth described in CLAUDE.md.

---

## Section 5 — Public site and forms (plain language)

Public pages live at `legacy/public_html/`. The site is server-rendered PHP with a fixed
green/Christmas theme, a Santa + tree header, and a top menu: **Home, Donate, Application,
Contact Us**. A small **Admin** link sits in the footer of most pages.

### Home (`index.php`)
Mission statement, 30+ year history, Toys-for-Tots (Dubuque, IA) credit, how to donate (mail a
check; two Allegiant Oil drop-off sites with hours; cash/check payable to the project), and
key note that donations/applications begin **October 1**. A right-hand "Latest News" sidebar is
pulled live from the `bar` table (this year's info, special gifts list, applications note). Footer
"Useful Links": Pickup Schedule, PDF Application, Grant County website, plus the Toys-for-Tots
logo. **No form on this page.**
- Note: the mailing address is shown **inconsistently** across the site (see Section 6).

### Donate (`donate.php`)
Explains giving by check/drop-off and offers a **PayPal** "Donate" button (a hardcoded PayPal
hosted-button ID). **[Important]** this file also contains server code that will **insert a donor
row** if donor fields are posted to it, and its login check is commented out — i.e., there is an
unauthenticated path that writes to the `donor` table (see Section 6). The visible PayPal form
itself does not post those donor fields, but the open insert code is present.

### Application (`application/application.php`)
The five-step online application described in Section 3. On the final step it writes to
`applicants`, `appEmp`, `benefits`, `children`, and `goodDeed`, then shows a one-line "successfully
submitted" confirmation. No email is sent to the applicant at submit time. Uses PHP session state
to carry data between steps (fragile to browser-back/refresh).

### Pickup schedule (`pickUp.php`)
Renders the 23 `pickup` rows into a fixed table (title, notice paragraph, ten date/description
pairs, footer). Read-only to the public. **No form.**

### Contact Us (`contactUs.php`)
A simple form: **Email (required, format-checked), Subject, Message.** On submit it emails the
message to `skleinow@co.grant.wi.gov` using PHP `mail()` and shows "Thank you for sending us
feedback." It does **not** write to the database. **[Risk]** the sender address is placed into the
email headers without sanitizing — a mail-header-injection vector (see Section 6).

### Public donor form (`newDonorform.html.php`, also embedded logic in `donate.php`)
A "DONATIONS" form collecting donor Full Name, Contact, Email, Phone, Address, City, State, Zip
and an **Add** button that inserts into `donor`. Publicly reachable and unauthenticated. Shows a
mailing address of **"PO Box 447, Lancaster, WI 53813"** (a third address variant — see Section 6).

### Validation summary (what the public forms actually enforce)
- Application step 1: first name, last name, address, city, phone required (via JS alert +
  server-side check). Email optional and **not** confirmed. City must be picked from the county
  dropdown.
- Application step 2: if an employer name is present, its wage and hours become required.
- Application step 3: number of household members required.
- Application step 4: each member's name and sex required.
- Application step 5: good deed required.
- Contact: email must pass a format check.
- No form has CSRF protection, rate limiting, spam/bot protection, or a maximum-length guard
  beyond the database column sizes.

---

## Section 6 — Integrations and external pieces

- **Database:** MySQL via PHP PDO. Connection is defined in `includes/dbConnect.php` and
  `includes/databasesetup.php` (a near-duplicate; `databasesetupcopy.php` is a third copy). All
  point at `grantco3_holidayProject` on `localhost`. (Real credentials were removed during
  discovery — see the end note.)
- **Admin authentication:** home-grown, session-based. Login runs `SELECT COUNT(*) FROM admin
  WHERE UserName = ? AND Password = ?` with **plain-text** passwords, then stores username and
  password in the PHP session. Each admin page guards itself by checking a session flag and
  `include`-ing/redirecting to login. Queries use PDO prepared statements (good), but see the
  auth gaps below. There is **no** `.htaccess`/server-level protection on `adminPanel/` (the
  `adminPanel/.htaccess` only sets the PHP handler; the root `.htaccess` is boilerplate Joomla
  rewrite rules unrelated to this app).
- **Email:** PHP `mail()` (server local mailer), used in two places: applicant Approve
  notification and the Contact form. From/notification address is `skleinow@co.grant.wi.gov`.
  There is **no** third-party email service (no Resend/SendGrid). Deliverability from a shared
  PHP host is typically poor; this is worth replacing.
- **PDF application:** a static file served at the site root (`/PDFapplication.pdf`), replaceable
  through the admin upload tool. The `upload/` folder contains several stale/duplicate copies
  (`PDF application.pdf`, `PDFapplication.pdf.pdf`, `pdfapplication.pdf`, `holiday project
  app.pdf`, etc.), suggesting the upload/replace flow is unreliable in practice.
- **PayPal:** a hardcoded PayPal hosted-button ID on the Donate page (a live account reference).
  Confirm ownership/whether to keep.
- **Toys for Tots:** static logo `imgs/tft.gif`, credited on the home and sidebar ("Toys donated
  by Toys for Tots, Dubuque, IA"). No API/integration — just image + credit to preserve.
- **Grant County website:** outbound link only (`grantcounty.org`).
- **Operator user manual:** `adminPanel/upload/gchpManual.pdf`, a 24-page guide written by the
  2014 Southwest Wisconsin Technical College student team (Carl Zaluski, Traci Althaus, Josh
  Einsweiller, Sterling Scallon). Useful for confirming intended workflows. **Note:** page 4 of
  this PDF prints an admin username and password in plain text (an old 2014 credential, different
  from the live one). Flagged for removal/replacement before this repo is shared (see Section 8).

### Security and correctness issues found in the code
1. **Plain-text admin passwords**, stored in the DB and copied into the session. Must not be
   carried forward.
2. **Real credentials were committed to this repo** (DB connection strings; the live admin
   username/password inside the SQL dump). Handled during discovery — see the end note — but the
   underlying practice (secrets in code/dumps) must not repeat, and the live passwords should be
   rotated by the owner.
3. **Auth checks disabled on some admin pages.** `adminPanel/sidebar/index.php` has its login
   check **commented out**, so the homepage news/sidebar content is add/edit/deletable without
   logging in. `donate.php` also has its login check commented out and contains an **open,
   unauthenticated `INSERT` into `donor`** — a spam/abuse and data-integrity vector. **Verify on
   the live site** whether these are reachable as written.
4. **Mail header injection** in the Contact form: the user-supplied email is concatenated into the
   `From:` header unsanitized.
5. **Possible SQL injection** in one admin query: the applicant edit path builds
   `"select * from children where appID = " . $appID` by string concatenation instead of a bound
   parameter (admin-only, but still unsafe). Most other queries are properly parameterized.
6. **No confirmation on destructive single-record deletes** (delete applicant, delete donor,
   delete sidebar block, delete member). Only "DELETE ALL APPLICANTS" prompts, and even that has
   no undo.
7. **Fragile applicant flow:** all progress is held in server session; the form explicitly warns
   users not to use browser back or close the window, or they lose everything. No save/resume.
8. **Redirect-after-output bugs:** several pages call `header("Location: …")` after HTML has
   already been sent (won't reliably redirect); the login "guard" uses `include`/`header` without
   `exit` in places, so protected content can still render.
9. **10-second artificial delay** (`sleep(10)`) after Approve/Deny before returning to the list —
   pure UX cost.
10. **Upload weaknesses:** allows `.doc` as well as `.pdf`, saves under the original filename (so
    it may not overwrite the public link target), and relies on `getimagesize` checks that don't
    apply to PDFs. Files land in a web-served folder.
11. **Data-quality:** the live `donor` table contains obvious spam/test rows ("buspar", etc.),
    and `applicants.date` / `approved` / `reviewed` are stored as strings, making sorting and
    filtering unreliable.
12. **Address inconsistency (content bug):** the site shows the mailing address three ways —
    **"235 W. Elm St."** (home page mailing block), **"245 W. Elm St."** (home page cash-donation
    line and the `bar` sidebar text), and **"PO Box 447"** (Donate / new-donor page). Must be
    reconciled before launch (CLAUDE.md already flags 235 vs 245; the PO Box is a third variant).
13. **Huge `error_log` files** were present throughout the tree (one ~125 MB) and removed during
    discovery; on the live host these can leak paths/errors and should be disabled/rotated.

### Dead / unused code (safe to drop; do not port)
`application/applicationold.php` and `application/app.php` (earlier drafts of the wizard);
`index.php.off`; the root `adminLogin.php` and root `sidebar.html.php` (broken/mismatched
leftovers — the root login form posts field names the real login doesn't read); `.smileys/`,
`.wysiwygPro_preview_*.php`, `.well-known/acme-challenge/`; `imgsOld/`; the `donations`/`donator`/
`appben`/`deed`/`citycode`/`sidebar` tables from the non-live databases; and the duplicate
`databasesetupcopy.php`. (The `zippedFiles/` archive of old source and the loose image ZIPs were
removed during discovery.)

---

## Section 7 — Seasonal and time logic

- **Program calendar:** donations and applications open **October 1** each year (stated in page
  content and the `bar` sidebar). Pickup happens across **December** (the current `pickup` data
  lists Dec 2–16 dates and per-town times, with a "stragglers" tail and an "items returned to
  inventory after Dec 16" rule).
- **No automatic date gating in code.** The application form does not open/close itself by date;
  whether applications are "open" is communicated only through the editable sidebar/news text.
  Nothing programmatically prevents an off-season submission.
- **"Current season" is implicit,** created by wiping the tables at close-out rather than by a
  season/year field. The admin has no year selector; the applicant list is simply whatever is in
  the table now. The application `date` is stamped at submit as `YYYY/M/D` text.
- **Yearly-changing content lives in two editable tables:** `bar` (this year's info, special gifts
  list, "applications open" note) and `pickup` (the schedule). Everything else that changes yearly
  in principle (mission tweaks, key dates in the home-page body) is **hard-coded in page HTML**,
  so today the developer — not the operator — would have to change it.
- **Implication for the rebuild:** introduce an explicit season/year on records so seasons
  coexist and "purge old seasons" becomes a safe filter; and decide (Section 9) exactly which
  yearly content the operator edits herself vs. the developer.

---

## Section 8 — Carry forward vs. simplify vs. retire

**KEEP (preserve the behavior/value):**
- The online application capturing household, income, benefits, per-member clothing/gift needs,
  and the good deed — *keep the data captured*, but redesign the flow (see SIMPLIFY).
- The **pay-it-forward** good-deed requirement as part of eligibility.
- **Both fallbacks:** the downloadable PDF application and the message phone line (feature them,
  don't bury them).
- Admin ability to **review, edit, approve/deny** applications, **add/remove household members**,
  and produce a **printable per-household packing/pickup slip** (replace the Word download with a
  clean print/PDF view).
- Operator-editable **this-year content**: news / special gifts list (`bar`) and **pickup
  schedule** (`pickup`).
- **Donor** directory (add/edit/search) — with test rows cleaned out.
- Public content to carry: mission/history, Toys-for-Tots credit + logo, donation drop-off info,
  key dates, Grant County link, contact details.

**SIMPLIFY:**
- The 5-step, session-bound wizard → one short, forgiving, mobile-first form that never wipes
  entered data and doesn't depend on avoiding the browser back button. Reason: the current flow is
  fragile and hostile to old phones/stressed users.
- Alert-box, one-field-at-a-time validation → inline, kind, specific messages. Reason: WCAG/AA and
  usability.
- The confirmation ("submitted, thank you") → a reassuring "what happens next" page + optional
  immediate confirmation email. Reason: dignity/anxiety.
- Pickup editor's 23 fixed boxes and sidebar's manual ID entry → structured, add/remove rows.
  Reason: the operator shouldn't manage row numbers.
- Per-applicant Word `.doc` slip → HTML print view / generated PDF. Reason: cleaner, no Office
  dependency.
- Season close-out → keep-history + per-season purge (needs a year field). Reason: CLAUDE.md
  requires downloadable export + purge of prior seasons, not a blind wipe.
- Add the missing **"Download list for Excel" (CSV)** export. Reason: explicit CLAUDE.md
  requirement absent today.

**RETIRE (do not reuse):**
- Plain-text password auth and the `admin` table approach → replace with passwordless magic-link.
- The committed DB connection files and any secrets; the stale credential printed in
  `gchpManual.pdf` (remove or replace that PDF before sharing the repo).
- The two non-live databases (`grantco3_hproject`, `grantco3_testing`).
- The unauthenticated public donor-insert path and the commented-out auth guards.
- PHP `mail()` for notifications → a real email service (e.g., Resend) or in-dashboard review.
- The unused `donations` table (unless donation tracking is explicitly wanted).
- All dead code listed in Section 6.
- The Word-export "Generate Household" mechanism (replaced by print view).

**Security items to act on (owner):** rotate the live admin password and the MySQL password (both
were exposed in the repo); confirm the sidebar/donate auth-disabled paths are not live; and remove
the stale credential PDF.

---

## Section 9 — Open questions

> **ANSWERED 2026-07-12 by the owner — see `docs/decisions.md` for the authoritative answers.**
> Key outcomes: no live credentials will be provided (work from code + screenshots); the correct
> address is **235 W. Elm St.** (PO Box 447 also current); no Spanish version; Admin = Operator,
> one shared login, only "Admin" and "Applicant" roles; the new form follows the paper rules with
> the required-field set defined in decision 6; confirmation email on submit plus admin-triggered
> approve/deny emails; members captured uniformly; donations recorded + directory kept + PayPal
> retained; data kept indefinitely with admin edit/delete/export; "adopt" = anonymous community
> sponsor; the new system should assign/track pickup-slip numbers.
> Note: decision 10 (keep data indefinitely) supersedes this document's earlier assumption that
> season close-out requires a purge.

The original questions, for the record:

1. **Live admin access:** please provide the read-only URL + login so the live UI can be verified
   against this inventory (especially: whether the sidebar/donate auth-disabled code paths are
   actually reachable, and the real sort order and paging of the applicant list).
2. **Correct mailing address:** 235 vs 245 W. Elm St. — and is "PO Box 447" current or obsolete?
   Which single address should the new site show everywhere?
3. **Spanish version?** CLAUDE.md's open question — is a Spanish-language application needed for
   this community?
4. **Who edits yearly content?** Confirm the operator will self-edit news, special gifts list,
   key dates, and pickup schedule (build plain admin screens for all of these), vs. developer-
   edited. The legacy lets her edit `bar` and `pickup` but not the home-page body text.
5. **Eligibility rules to enforce online:** should the new form represent the paper rules — "no
   single/married-without-children unless permanently disabled or over 65," "years received,"
   "adopted last year"? The current online form ignores these.
6. **Which fields are truly required?** Every extra field loses applicants. Confirm the minimum
   set (e.g., is email/blanket-size/diabetic necessary at submit, or optional?).
7. **Applicant notifications:** send an **immediate** confirmation email on submit? Keep approve/
   deny emails? Deny currently sends nothing — intended?
8. **Household members labeling:** the data calls all members "children"; confirm the form should
   capture adults + children uniformly (it effectively does today).
9. **Donations tracking:** keep only the donor directory (as today), or actually record donations
   (the `donations` table is unused)? Keep the PayPal button and, if so, whose account?
10. **Data retention/privacy:** how long should approved/denied applicant records be kept, and
    should close-out **archive/export** before purge rather than delete outright?
11. **"Permission to adopt" wording:** what exactly does this authorize, and how should it be
    phrased plainly for applicants?
12. **Pickup slip contents (PU#, #Bags):** are these filled in by hand after printing, or should
    the new system assign/track them?

---

### Discovery data-handling note
The legacy copy provided was **not** fully scrubbed. During this discovery the following was found
and remediated **with the owner's approval**, in-session, before writing this inventory:
- The two SQL dumps (`schema.sql`, `localhost.sql`) were full production dumps containing real
  applicant PII (names, addresses, phones, emails, household details) and the live admin
  username/password. They were replaced with a **structure-only** `schema.sql` (schema + harmless
  reference/content tables `cities`, `bar`, `pickup` retained; all PII/credential rows removed);
  `localhost.sql` was deleted as a duplicate.
- Real DB credentials in `includes/dbConnect.php`, `databasesetup.php`, and `databasesetupcopy.php`
  were redacted to placeholders.
- `zippedFiles/` (old source with embedded 2014 credentials), the loose image ZIPs, and all
  bloated `error_log` files were removed.
- Git history was rewritten (single commit amended; reflog expired; aggressive gc) so the original
  PII/credential blobs are gone. The repo has **no remote** and was never pushed.

**Still outstanding (owner action):** rotate the live admin password and the MySQL password; and
decide how to handle the stale credential printed inside `gchpManual.pdf`.
