import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const ORIGIN = 'https://grantcountyholidayproject.org';
// The indexable public pages. Derived by hand and pinned: if a new public page
// is added, this test forces the author to decide whether it joins the sitemap.
const INDEXABLE = ['/', '/apply', '/donate', '/pickup', '/contact', '/pay-it-forward'];

describe('seo', () => {
  it('sitemap lists exactly the indexable pages', () => {
    const xml = readFileSync('public/sitemap.xml', 'utf8');
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.sort()).toEqual(INDEXABLE.map((p) => `${ORIGIN}${p}`).sort());
  });

  it('every top-level public page is accounted for (sitemap or noindex)', () => {
    const pages = readdirSync('src/pages').filter((f) => f.endsWith('.astro'));
    for (const f of pages) {
      const route = f === 'index.astro' ? '/' : `/${f.replace('.astro', '')}`;
      expect(INDEXABLE, `src/pages/${f} is not in the sitemap — add it or mark it noindex and update this test`).toContain(route);
    }
    // The one intentionally non-indexable page:
    expect(readFileSync('src/pages/apply/thank-you.astro', 'utf8')).toContain('noindex');
  });

  it('robots.txt keeps the admin disallow and gains the sitemap line', () => {
    const robots = readFileSync('public/robots.txt', 'utf8');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('the shared layout emits canonical, OG, and twitter markers', () => {
    const layout = readFileSync('src/layouts/Site.astro', 'utf8');
    for (const marker of ['rel="canonical"', 'og:title', 'og:image', 'twitter:card', 'noindex']) {
      expect(layout).toContain(marker);
    }
    // Pinned regression: prerendered pages see Astro.url.pathname with a trailing
    // slash at build time (e.g. "/donate/"), which would emit a canonical that
    // disagrees with the slash-free sitemap above. The canonical must normalize
    // the same way the nav's `current` highlight does.
    expect(layout).toContain("replace(/\\/$/, '')");
  });

  it('every public page passes its own description', () => {
    const files = ['index', 'apply', 'donate', 'pickup', 'contact', 'pay-it-forward'].map((n) => `src/pages/${n}.astro`);
    files.push('src/pages/apply/thank-you.astro');
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), `${f} should pass description=`).toMatch(/<Site[^>]+description=/);
    }
  });
});
