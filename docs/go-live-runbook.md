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
- [ ] **Create the Pages project.** The project must exist before you can set secrets. Pick ONE path:
      - **Path A — GitHub (recommended: gives push-to-deploy + PR previews + an offsite backup).**
        This repo has no remote yet, so first create a **Private** repo on github.com (e.g. `gchp-site`;
        no README/.gitignore/license), then push it:
        `git remote add origin https://github.com/<you>/gchp-site.git` and `git push -u origin main`
        (safe to push — secrets and the real `dump.sql`/`import.sql` are git-ignored, legacy is scrubbed).
        Then in the dashboard: **Workers & Pages → Create → Pages → Connect to Git** → pick the repo →
        project name `gchp-site`, production branch `main`, build command `npm run build`, output
        directory `dist`, build variable `NODE_VERSION=22`. The first build may fail until secrets +
        `database_id` are set — expected; re-deploy after.
      - **Path B — Direct upload (no GitHub needed; simpler, but no push-to-deploy/PR previews).**
        `npm run build` then `npx wrangler pages deploy dist --project-name gchp-site` — the first run
        creates the project and deploys. Future code changes ship by re-running those two commands.
      - Do NOT use `wrangler pages project create` for Path A — a Direct-Upload project can't be
        connected to Git afterward.
- [ ] Confirm the `admin_emails` seed lists the correct operator + owner addresses; edit
      `migrations/0002_seed.sql` first if not (it has not been applied to production yet).
- [ ] Apply the schema + seed to production (this runs `migrations/0001_init.sql` then
      `0002_seed.sql` in order and tracks them): `npm run db:migrate:remote`
      (equivalently `npx wrangler d1 migrations apply gchp --remote`).
- [ ] Set the two secrets (never commit them). Generate a fresh 64-hex CSRF value first:
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Then EITHER:
      - **Dashboard (simplest):** the `gchp-site` project → **Settings → Variables and Secrets** → add
        `CSRF_SECRET` (paste the hex) and `RESEND_API_KEY` (your Resend key), both as **Secret** (encrypted),
        for the **Production** environment. OR
      - **CLI:** `npx wrangler pages secret put CSRF_SECRET --project-name gchp-site` then
        `npx wrangler pages secret put RESEND_API_KEY --project-name gchp-site`. **Note:** `CSRF_SECRET`
        is the secret's NAME you type in the command; each command then prompts `Enter a secret value:`
        — paste the value THERE, not on the command line (that also keeps it out of your shell history).

## 4. Load the migrated data
- [ ] `npx wrangler d1 execute gchp --file=import.sql --remote`
- [ ] Spot-check counts: `npx wrangler d1 execute gchp --command "SELECT (SELECT COUNT(*) FROM donors) AS donors, (SELECT COUNT(*) FROM applications) AS apps, (SELECT COUNT(*) FROM household_members) AS members, (SELECT COUNT(*) FROM employers) AS employers" --remote` and compare to the migration report.

## 5. Deploy the app (not yet the live domain)
- [ ] The Pages project was created in Step 3. Now that the `database_id`, bindings, and secrets are
      in place, trigger a fresh deploy: **Path A (GitHub):** push a commit to `main` or use
      **Deployments → Retry deployment** in the dashboard. **Path B (direct upload):** re-run
      `npm run build` then `npx wrangler pages deploy dist --project-name gchp-site`. Confirm it builds
      green and the `*.pages.dev` URL loads.
- [ ] Confirm the D1 (`DB` → `gchp`) and R2 (`FILES` → `gchp-files`) bindings are attached to the
      project (they come from `wrangler.toml`; if the dashboard doesn't show them, add them under
      **Settings → Bindings**).
- [ ] Upload the current paper-application PDF via the admin (`/admin/paper-application`) on the
      `*.pages.dev` URL, or put it in R2 as `application.pdf`.

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

---

## Shipping a code update after go-live (e.g. Plan 5, and any future change)

Use this short checklist whenever you have new code on `main` that you want live.
It is much shorter than the full go-live above — the site, data, DNS, and secrets
already exist. **Do the steps in order.** The golden rule: **migrate the live
database BEFORE you deploy the new code.** New code that reads new columns will
error on the live site until the matching migration is applied.

- [ ] **0. Log in to Wrangler.** From the project folder: `npx wrangler login`
      (opens a browser), then `npx wrangler whoami` to confirm.
      - If a command later fails with **`code: 7403` "account is not valid or is
        not authorized"**, your session expired or the wrong Cloudflare account is
        selected — re-run `npx wrangler login` and confirm `whoami` shows the
        account that owns the `gchp` D1 / `gchp-site` Pages project.
- [ ] **1. Get the latest code** (only if deploying from a different machine than
      the one that has it): `git pull`.
- [ ] **2. Confirm it's healthy locally:** `npm run test` (expect all green) and
      `npm run build`.
- [ ] **3. Apply any new database migration to the LIVE database FIRST:**
      `npm run db:migrate:remote`. Wrangler only applies migrations not yet run, so
      this is safe to run every time — if there's nothing new it's a no-op.
      - **This order is not optional.** Example: migration `0006` adds the
        `decided_at` column the code writes on every Approve/Deny and reads in the
        Excel export — deploying the code before the migration breaks those
        actions with a "no such column" error until you migrate.
      - Plan 5 adds **`migrations/0003_relationships.sql`** (per-person relationship,
        disabled/part-time, shoe/coat sizes, plus a parentage note and admin-only
        notes). Every statement is `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT ''`
        / `DEFAULT 0` — **additive and non-destructive**; existing rows keep working.
- [ ] **4. Build and deploy:** `npm run build` then
      `npx wrangler pages deploy dist --project-name gchp-site`.
- [ ] **5. Verify on the live site** (`grantcountyholidayproject.org`):
      - Sign in to `/admin`, open an existing application detail — it should load
        (this is the path Plan 5 touched most).
      - Download the Excel list (**Applications → Download list for Excel**) and
        confirm the new columns are present (relationship labels, parentage note,
        your-notes).
      - If applications are open, submit one test application through `/apply` to
        confirm the new per-person questions save; delete it afterward.
- [ ] **Note — settings are not affected by a deploy.** Whether applications are
      **open or closed** lives in the database, not the code, so deploying does not
      change it. Apps stay closed until you toggle them in the admin home screen
      (open them on/after **October 1**).
- [ ] **Rollback if needed:** Cloudflare Pages keeps every prior deployment — in
      the dashboard (**Workers & Pages → gchp-site → Deployments**) you can roll back
      to the previous one instantly. The migration is additive, so it does not need
      to be undone.

### Operational status (verified 2026-07-18)
- [x] The downloadable **paper application** (`/application.pdf`) is live (uploaded
      2026-07-15). Replacements go through the admin **`/admin/paper-application`**
      screen (one-button upload).
