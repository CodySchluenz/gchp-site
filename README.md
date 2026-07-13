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
