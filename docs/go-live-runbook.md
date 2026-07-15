# Go-Live Runbook — Grant County Holiday Project

Ordered checklist to migrate data and cut over to the new site. The old PHP site stays live and
untouched until the final cutover step. Do the steps in order. Values in `<angle brackets>` are
yours to fill in; never paste secrets into this file or any commit.

## 0. Before you start
- [ ] Confirm `main` builds and tests pass locally: `npm run test`, `npm run build`.
- [ ] Have a Cloudflare account with the domain available, and the old site's database access.

## 1. Export the old database
- [ ] In the old host's phpMyAdmin (or cPanel), export the `grantco3_holidayProject` database as a
      single **SQL** file (Export → Custom → SQL, "structure and data"). Save it as `dump.sql` in the
      project root. It is git-ignored — do not commit it.
- [ ] Only that database is needed; ignore `grantco3_hproject` and `grantco3_testing`.

## 2. Build the import file (offline, safe to repeat)
- [ ] Run: `node scripts/migrate/run.mjs dump.sql`
- [ ] Read the printed **migration report**: donor/application/member/employer counts (sanity-check
      against the old site), the likely-junk donors to delete later, the applications given a
      placeholder "self" member, and any W-2 amounts folded into "other income".
- [ ] Open the generated `import.sql` and skim it. It is git-ignored — do not commit it.

## 3. Provision production Cloudflare resources
- [ ] Create the production D1 database: `wrangler d1 create <DB_NAME>` and put its binding/id in
      `wrangler.toml` (production environment).
- [ ] Create the R2 bucket for the paper application PDF and bind it (`FILES`).
- [ ] Set secrets (never commit them): `wrangler pages secret put CSRF_SECRET` (use a fresh 64-hex
      random value), `wrangler pages secret put RESEND_API_KEY`.
- [ ] Apply the schema + seed to production:
      `wrangler d1 execute <DB_NAME> --file=migrations/0001_init.sql --remote` then
      `wrangler d1 execute <DB_NAME> --file=migrations/0002_seed.sql --remote`.
- [ ] Confirm the `admin_emails` seed lists the correct operator + owner addresses (edit
      `migrations/0002_seed.sql` before applying if not).

## 4. Load the migrated data
- [ ] `wrangler d1 execute <DB_NAME> --file=import.sql --remote`
- [ ] Spot-check counts: `wrangler d1 execute <DB_NAME> --command "SELECT (SELECT COUNT(*) FROM donors) AS donors, (SELECT COUNT(*) FROM applications) AS apps, (SELECT COUNT(*) FROM household_members) AS members, (SELECT COUNT(*) FROM employers) AS employers" --remote` and compare to the migration report.

## 5. Deploy the app (not yet the live domain)
- [ ] Connect the GitHub repo to Cloudflare Pages; set the production branch to `main` and
      `NODE_VERSION=22` in the Pages build settings. Deploy.
- [ ] Upload the current paper-application PDF via the admin (`/admin/paper-application`) on the
      Pages preview URL, or put it in R2 as `application.pdf`.

## 6. Verify on the Pages URL — BEFORE touching DNS
- [ ] Sign in to `/admin` via the magic link (confirm the email arrives and the link works).
- [ ] Spot-check a few migrated donors and applications in the admin; open one application detail.
- [ ] Delete the flagged-junk donors listed in the migration report (admin → Donors → Delete).
- [ ] Submit a **real test application** through the public form; confirm it appears in the admin and
      the confirmation email arrives. (Delete it afterward.)
- [ ] Check the public pages at 360px width (home, apply, donate, pickup, contact).

## 7. DNS cutover
- [ ] In Cloudflare Pages, add the custom domain and follow the prompts to point DNS at Pages.
- [ ] The old PHP site stays live as a fallback until you confirm the new site is stable. Do not take
      it down yet.
- [ ] Watch the new site for a few days across a real apply + a real admin login.

## 8. Post-cutover cleanup
- [ ] Rotate the old **admin password** and the old **MySQL password** (both were exposed in the
      original repo and chat).
- [ ] Remove or redact `legacy/public_html/adminPanel/upload/gchpManual.pdf` on the old host (it
      prints a stale 2014 admin username/password and is publicly downloadable).
- [ ] Once the new site is confirmed stable, decommission the old PHP site.
- [ ] Delete the local `dump.sql` and `import.sql` (they hold real PII).
