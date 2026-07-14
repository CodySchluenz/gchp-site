# Grant County Holiday Project — Website

Volunteer-run charity site for Grant County, WI. Astro + Tailwind on Cloudflare Pages,
data in Cloudflare D1, files in R2, email via Resend. See `CLAUDE.md` for project rules,
`docs/superpowers/specs/` for the design spec, and `docs/legacy-inventory.md` for how the
old PHP site worked.

## Local development

1. `npm install`
2. `cp .dev.vars.example .dev.vars` and fill in values (any random string works for
   `CSRF_SECRET` in dev; a real `RESEND_API_KEY` is only needed to test email sending).
3. `npm run db:migrate:local`
4. `npx wrangler r2 object put gchp-files/application.pdf --file "legacy/public_html/PDFapplication.pdf" --local`
5. `npm run dev` → http://localhost:4321

Tests: `npm run test`. Build: `npm run build`.

### Working on the application form

Applications are gated by a switch in the database (closed by default). To open them locally:

    npx wrangler d1 execute gchp --local --command "UPDATE settings SET applications_open = 1 WHERE id = 1"

Submitted test applications land in the `applications` table:

    npx wrangler d1 execute gchp --local --command "SELECT id, first_name, status FROM applications"

### Working on the admin console

Sign-in needs an allow-listed email and a session. Two working ways to get in locally:

1. **Mint a token directly, then click through the interstitial.** Insert an allow-listed
   email, then insert a login token with a known raw value and open the verify link:

       npx wrangler d1 execute gchp --local --command "INSERT OR IGNORE INTO admin_emails (email) VALUES ('you@example.com')"

   Generate a random token, store its SHA-256 hash in `login_tokens` (with a far-future
   `expires_at`), then open `http://localhost:4321/admin/verify?token=<raw>` and click
   "Sign me in". (The raw token is what you put in the URL; only its hash is stored.)

2. **Create a session row directly** (fastest for iterating on admin pages): generate a
   random id, store its SHA-256 hash in `sessions` with a far-future `expires_at`, and send
   the raw id as the `admin_session` cookie on your requests.

Editors live at `/admin/content`, `/admin/pickup`, and `/admin/paper-application`. Content
and pickup rows soft-delete (Undo appears right after); the applications-open toggle is on
the admin home. Test rows in the applications tables must be deleted children-first
(`household_members`, `employers`, then `applications`).

## Production setup (one time)

1. **Create the database:** `npx wrangler d1 create gchp` — paste the printed
   `database_id` into `wrangler.toml`, commit.
2. **Apply migrations:** `npm run db:migrate:remote`
3. **Create the bucket:** `npx wrangler r2 bucket create gchp-files`
4. **Upload the paper application:**
   `npx wrangler r2 object put gchp-files/application.pdf --file "legacy/public_html/PDFapplication.pdf" --remote`
5. **Create the Pages project:** Cloudflare dashboard → Workers & Pages → Create →
   Pages → connect this GitHub repo. Build command `npm run build`, output `dist`.
   Production branch `main` (PRs get preview URLs automatically).
   Under Settings → Environment variables, also set `NODE_VERSION` to `22` so the build image uses the right Node (wrangler 4.x requires Node ≥ 22).
6. **Bind resources:** Pages project → Settings → Bindings: D1 `DB` → `gchp`,
   R2 `FILES` → `gchp-files`.
7. **Secrets:** Pages project → Settings → Environment variables:
   `RESEND_API_KEY` (from resend.com), `CSRF_SECRET` (long random string, e.g.
   `openssl rand -hex 32`).
8. **Resend domain:** resend.com → Domains → add `grantcountyholidayproject.com` →
   add the DNS records it shows at the current DNS host → wait for "Verified".

## Cutover (later — see Plan 4)

The old PHP site stays live and untouched until the new site is verified. DNS moves at
the current DNS host. Post-cutover: rotate the old admin/MySQL passwords and remove
`gchpManual.pdf` from the old host.
