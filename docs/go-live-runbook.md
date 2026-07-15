# Go-Live Runbook — Grant County Holiday Project

Ordered checklist to migrate data and cut over to the new site. The old PHP site stays live and
untouched until the final cutover step. Do the steps in order. Values in `<angle brackets>` are
yours to fill in; never paste secrets into this file or any commit.

## 0. Before you start
- [ ] Confirm `main` builds and tests pass locally: `npm run test`, `npm run build`.
- [ ] Have a Cloudflare account with the domain available, and the old site's database access.
- [ ] **Wrangler is a local project dependency, not a global command.** Run every `wrangler`
      command below through `npx` (e.g. `npx wrangler ...`) from the project folder, OR use the
      `npm run` shortcuts noted below. Check it works: `npx wrangler --version` (expect 4.x).
- [ ] **Log in once** so the `d1`/`r2`/`pages` commands can reach your account:
      `npx wrangler login` (opens a browser to authorize). Confirm with `npx wrangler whoami`.
- [ ] The project's `wrangler.toml` already names the pieces: Pages project `gchp-site`, D1 database
      `gchp` (binding `DB`), R2 bucket `gchp-files` (binding `FILES`). Use those names below.

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
- [ ] Create the production D1 database: `npx wrangler d1 create gchp`. It prints a `database_id` —
      paste it into `wrangler.toml` (replace the `database_id = "set-in-task-13-..."` placeholder on
      the `[[d1_databases]]` block), then commit that one-line change.
- [ ] Create the R2 bucket for the paper application PDF: `npx wrangler r2 bucket create gchp-files`.
- [ ] Confirm the `admin_emails` seed lists the correct operator + owner addresses; edit
      `migrations/0002_seed.sql` first if not (it has not been applied to production yet).
- [ ] Apply the schema + seed to production (this runs `migrations/0001_init.sql` then
      `0002_seed.sql` in order and tracks them): `npm run db:migrate:remote`
      (equivalently `npx wrangler d1 migrations apply gchp --remote`).
- [ ] Set secrets (never commit them). Generate a fresh 64-hex CSRF secret with
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, then:
      `npx wrangler pages secret put CSRF_SECRET --project-name gchp-site` (paste the value), and
      `npx wrangler pages secret put RESEND_API_KEY --project-name gchp-site` (paste your Resend key).

## 4. Load the migrated data
- [ ] `npx wrangler d1 execute gchp --file=import.sql --remote`
- [ ] Spot-check counts: `npx wrangler d1 execute gchp --command "SELECT (SELECT COUNT(*) FROM donors) AS donors, (SELECT COUNT(*) FROM applications) AS apps, (SELECT COUNT(*) FROM household_members) AS members, (SELECT COUNT(*) FROM employers) AS employers" --remote` and compare to the migration report.

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
