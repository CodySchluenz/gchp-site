# Public-Site SEO — Design

Date: 2026-07-25. Status: approved by owner in brainstorming.

## Why

Families search for "holiday help Grant County" and "Grant County Holiday Project"
starting late September; the site should be the clear, well-presented first result by
October 1. Today the public pages have titles + one shared generic description, a
robots.txt, and nothing else: no canonicals, no per-page descriptions, no social
cards, no sitemap, no structured data, and the post-submit thank-you page is
indexable. The old .com site still competes in search (owner-side task).

## Non-negotiables (inherited)

- NO analytics or tracking of any kind. No new dependencies. Public pages stay
  lightweight and JS-optional (everything here is static head markup + two files).
- Copy is warm, plain, and written for a family searching for help — descriptions
  are applicant-facing text, held to the same dignity standard as the site.
- Admin routes are untouched (already auth-gated + robots-disallowed).
- Straight apostrophes in code copy.

## Current state (audited 2026-07-25)

`Site.astro` head: charset, viewport, `{title} — Grant County Holiday Project`,
one default description prop nobody overrides. `astro.config.mjs`: no `site`.
`public/robots.txt`: allow all, `Disallow: /admin`, no Sitemap line. No sitemap,
no canonical/OG/JSON-LD. 7 public pages (index, apply, donate, pickup, contact,
pay-it-forward, apply/thank-you). `public/images/header-banner.png` exists.

## Changes

### 1. `astro.config.mjs`

Add `site: 'https://grantcountyholidayproject.org',` to the config object.

### 2. `src/layouts/Site.astro` — head additions

Props gain `noindex?: boolean` (default false). Head gains, derived from existing
props (canonical from `new URL(Astro.url.pathname, Astro.site)`):

```html
<link rel="canonical" href={canonical} />
{noindex && <meta name="robots" content="noindex" />}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Grant County Holiday Project" />
<meta property="og:title" content={`${title} — Grant County Holiday Project`} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={new URL('/images/header-banner.png', Astro.site).href} />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
```

### 3. Per-page descriptions (exact copy)

| Page | `description=` |
|---|---|
| index | "The Grant County Holiday Project provides holiday food, gifts, and clothing to hundreds of Grant County, Wisconsin families and elderly neighbors every December. Over 30 years of neighbors helping neighbors, with Tri-State Toys for Tots." |
| apply | "Apply online for holiday food, gifts, and clothing for your family in Grant County, Wisconsin. One short form, no account needed — or call the message line or use the paper application. Your information stays private." |
| donate | "Give to the Grant County Holiday Project: mail a check, drop off toys and goods at Allegiant Oil in Platteville or Lancaster, or donate online. Every gift stays in Grant County, Wisconsin." |
| pickup | "Pickup days, times, and locations for Grant County Holiday Project families. Find your town's pickup schedule for this season." |
| contact | "Questions about applying, donating, or the Grant County Holiday Project? Send us a message or call the message line — a volunteer will get back to you." |
| pay-it-forward | "Every Holiday Project family pays it forward with good deeds for their neighbors. Learn how the pay-it-forward promise works and why it matters." |
| apply/thank-you | (any short line; page is `noindex` — also passes `noindex` to `Site`) |

(Verify factual claims against the live pages while implementing — e.g. drop
"donate online" from the donate description if the page has no PayPal button;
the `_headers` CSP allows a PayPal form action, so it likely exists — confirm.)

### 4. JSON-LD on the home page only

Inline `<script type="application/ld+json">` (a data block — not executed, so the
CSP `script-src 'self'` does not apply; crawlers parse it from HTML):

```json
{
  "@context": "https://schema.org",
  "@type": "NGO",
  "name": "Grant County Holiday Project",
  "url": "https://grantcountyholidayproject.org/",
  "logo": "https://grantcountyholidayproject.org/images/header-banner.png",
  "email": "skleinow@co.grant.wi.gov",
  "telephone": "+1-608-723-2136",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "245 W. Elm St.",
    "addressLocality": "Lancaster",
    "addressRegion": "WI",
    "postalCode": "53813",
    "addressCountry": "US"
  },
  "areaServed": "Grant County, Wisconsin",
  "description": "An all-volunteer program providing holiday food, gifts, and clothing to Grant County, Wisconsin families and elderly neighbors, in partnership with Tri-State Toys for Tots."
}
```

### 5. Sitemap + robots

`public/sitemap.xml` — hand-written, the 6 indexable pages (`/`, `/apply`,
`/donate`, `/pickup`, `/contact`, `/pay-it-forward`) as absolute
`https://grantcountyholidayproject.org` URLs; no lastmod/priority noise.
`public/robots.txt` gains `Sitemap: https://grantcountyholidayproject.org/sitemap.xml`.

### 6. Test

`tests/seo.test.ts`: (a) sitemap URLs exactly equal the indexable public-page
inventory derived from `src/pages/*.astro` (so adding a page without updating the
sitemap fails); (b) robots.txt contains the Sitemap line and still disallows
/admin; (c) `Site.astro` source contains canonical + og:title + twitter:card
markers and the `noindex` branch; (d) every `<Site` usage in `src/pages` passes a
`description=` (thank-you may pass any; it must pass `noindex`).

## Owner tasks after deploy (goes in the runbook + summary, not code)

1. Google Search Console: verify the domain (DNS TXT via Cloudflare) and submit
   the sitemap.
2. Old .com/Bluehost site: 301 its pages to the .org (or decommission); until
   then it competes in search.

## Out of scope

Analytics of any kind; blog/content marketing; keyword optimization beyond honest
descriptions; Bing/other consoles (Bing ingests via IndexNow/GSC import — owner
can add later); OG image design work (existing banner suffices).
