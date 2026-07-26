# Managing the Website — Owner's Handbook

For the owner/developer (Cody). This is the "how do I run this thing" reference —
what the pieces are, how to ship changes, where to see traffic, and what to do
when something looks wrong. Sherlyn's day-to-day is covered by her guide and the
[Operations Manual](operations-manual.html) (same document as the 📖 artifact —
keep the two copies in sync); deployment step-by-step is the
[Go-Live Runbook](go-live-runbook.md).

## 1. The map — every service this site uses

| Piece | Where | Notes |
|---|---|---|
| Code | github.com/CodySchluenz/gchp-site | `main` = the truth. Deploys are manual — pushing does NOT deploy. |
| Hosting | Cloudflare Pages, project `gchp-site` | Direct-upload deploys via wrangler. Old deployments kept — instant rollback. |
| Database | Cloudflare D1, database `gchp` | All applications, donors, messages, history. The crown jewels. |
| Files | Cloudflare R2, bucket `gchp-files` | Just the blank paper-application PDF. |
| Domain + DNS | Cloudflare, `grantcountyholidayproject.org` | Includes the Google TXT verification record — never delete it. |
| Email sending | Resend (free tier) | Magic links + applicant confirmations, from no-reply@grantcountyholidayproject.org. |
| Search data | Google Search Console (your Google account) | Domain verified 2026-07-25; sitemap submitted. |
| Secrets | Cloudflare Pages → gchp-site → Settings → Variables | `CSRF_SECRET`, `RESEND_API_KEY`. Never in the repo. |

Everything runs on free tiers. Expected cost: **~$0/month + the domain (~$10/year)**.

## 2. Shipping a change

Full checklist: [Go-Live Runbook → "Shipping a code update after go-live"](go-live-runbook.md).
The short version, from the project folder:

```
npx wrangler login          # once per machine / when it expires
npm run test                # all green before anything ships
npm run db:migrate:remote   # THE GOLDEN RULE: migrate BEFORE deploying
npm run build
npx wrangler pages deploy dist --project-name gchp-site
```

If a deploy goes wrong: Cloudflare dashboard → Workers & Pages → gchp-site →
Deployments → roll back to the previous one (instant).

## 3. Seeing your traffic and search results

There are two dashboards, both zero-tracking (nothing runs on visitors'
browsers — that's a project rule, see below):

**Google Search Console** — [search.google.com/search-console](https://search.google.com/search-console)
(your Google account). This is the *search* picture:
- **Performance** → what people typed into Google, how often the site appeared
  (impressions), how often they clicked, and the average position. This is where
  "holiday help Grant County" queries show up.
- **Pages** (indexing) → which pages Google has indexed. All 6 public pages
  should show indexed within a few weeks of July 2026.
- **Sitemaps** → should show `sitemap.xml`, Success, 6 URLs.

**Cloudflare** — [dash.cloudflare.com](https://dash.cloudflare.com) → the
`grantcountyholidayproject.org` site → **Analytics & Logs → Traffic**. This is
the *visits* picture: requests, unique visitors, and traffic over time, measured
server-side by Cloudflare as it serves the pages. Nothing is installed on the
site itself. Expect a seasonal shape: quiet most of the year, a ramp from
October, peak in December.

**Reading the numbers:** you will see requests for paths like
`/wp-admin/install.php`, `/wp-login.php`, `/xmlrpc.php`, `/.env` — those are
bots scanning every domain on the internet for vulnerable WordPress sites.
This site has no PHP and no WordPress; they all get 404s and find nothing.
Harmless, and they dominate the charts in the off-season when real traffic is
quiet. Optional cosmetic fix: Cloudflare → Security → WAF → Custom rules →
block URI paths containing `.php` (the real site has zero .php URLs, so the
rule can never hit a legitimate visitor).

**The rule:** never add Google Analytics, Facebook pixels, or any client-side
tracker. "No third-party tracking or analytics that leak visitor data" is a
project non-negotiable (CLAUDE.md) — the two dashboards above cover every real
question without touching applicants' privacy.

## 4. Odd jobs only you can do (wrangler one-liners)

Run from the project folder after `npx wrangler login`. These touch the LIVE
database — read them before running them.

**Add an admin sign-in email** (the first task in any coordinator handover):

```
npx wrangler d1 execute gchp --remote --command "INSERT INTO admin_emails (email) VALUES ('person@example.com')"
```

**Remove one:**

```
npx wrangler d1 execute gchp --remote --command "DELETE FROM admin_emails WHERE email = 'person@example.com'"
```

**Sherlyn is locked out of sign-in** (too many tries — the limit is 10 per 15
minutes; this clears it immediately):

```
npx wrangler d1 execute gchp --remote --command "DELETE FROM rate_limits WHERE key LIKE 'signin:%'"
```

**Check whether the live database is missing migrations** (the usual cause of a
broken admin after a half-done deploy):

```
npx wrangler d1 migrations list gchp --remote
```

**Full data backup** (contains real family PII — treat the file like the
database itself; delete it when done):

```
npx wrangler d1 export gchp --remote --output=backup.sql
```

(Per-season Excel backups are easier for most purposes: admin → Applications →
"Download everything (backup)".)

## 5. When something looks broken

| Symptom | Likely cause → fix |
|---|---|
| Admin pages error right after a deploy | A migration didn't run. `npm run db:migrate:remote`, then redeploy. Migrate-first, always. |
| `wrangler` says error `7403` / not authorized | Login expired. `npx wrangler login`, confirm with `npx wrangler whoami`. |
| Magic-link email not arriving | Check spam; then Resend dashboard → Logs (did a send fire?); then the sign-in rate limit (section 4). |
| Public site shows stale content | Edge cache lag — wait a minute or hard-refresh. Public pages aren't durably cached. |
| Something else | Roll back the deployment (section 2) buys time; then debug from `npm run test` locally. Nothing the admin UI can do damages data — deletes are soft with Undo. |

## 6. The yearly rhythm (yours, not Sherlyn's)

The site is designed to need **nothing** from you in a normal year. Optional
September check, 10 minutes: `npm run test` still green, deploy anything that
accumulated, glance at Search Console before applications open October 1.
Sherlyn's own yearly tasks (news, schedule, PDF, open/close) are in her guide
and the Operations Manual — none of them need you.

## 7. The document set

| Document | Where | For |
|---|---|---|
| Go-Live Runbook | `docs/go-live-runbook.md` | You — deploys, migrations, owner follow-ups |
| This handbook | `docs/managing-the-website.md` | You — running the platform |
| Operations Manual | `docs/operations-manual.html` + 📖 artifact | Any coordinator, exhaustive |
| Sherlyn's guide | 🎄 artifact (claude.ai) | Sherlyn — warm quick-start |
| Design specs & plans | `docs/superpowers/` | The paper trail of every feature |
| CLAUDE.md | repo root | The project's rules, for any AI/dev working on it |

When admin features change: update the Operations Manual in BOTH places (repo
file + artifact) and Sherlyn's guide.
