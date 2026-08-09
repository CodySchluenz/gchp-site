import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The 2026-08-08 layout review (owner-approved): the packing slip gets a
// document header, a big boxed PU#, a labeled fact grid, printer-safe badges,
// and one-size-per-line cells. CONTENT is unchanged — slip-privacy.test.ts
// keeps pinning what may never appear; this file pins the layout landmarks
// so a refactor can't quietly regress them.
const slip = () => readFileSync('src/components/admin/SlipCard.astro', 'utf8');

describe('packing slip layout (2026-08-08 review)', () => {
  it('carries a document header naming the program, the paper, and the season', () => {
    const src = slip();
    expect(src).toContain('Grant County Holiday Project');
    expect(src).toContain('Packing Slip');
    expect(src).toContain('season_year');
  });

  it('shows the PU number in a big boxed corner, not inline text', () => {
    const src = slip();
    expect(src).toContain('class="pu"');
    expect(src).toContain('class="punum"');
  });

  it('lays the household facts out as a labeled grid, not a dot-separated sentence', () => {
    const src = slip();
    expect(src).toContain('class="factgrid"');
    expect(src).not.toContain('Household type: {a.household_type} ·');
  });

  it('renders DIABETIC as a bordered badge that survives black-and-white printing', () => {
    const src = slip();
    expect(src).toContain('class="badge"');
    expect(src).not.toContain('#b91c1c');
  });

  it('stacks sizes one per line inside the table', () => {
    expect(slip()).toContain('class="sz"');
  });

  it('boxes the note for packers', () => {
    expect(slip()).toContain('class="pnote"');
  });
});

// The print screens' own chrome (never printed) was bare 13px browser-default
// buttons — below the admin's 18px floor. Each print route styles its
// controls big; the print-chrome CSS is pinned here.
describe('print-screen chrome is operator-sized', () => {
  const routes = [
    'src/pages/admin/applications/slips.astro',
    'src/pages/admin/applications/pickup-slips.astro',
    'src/pages/admin/applications/labels.astro',
    'src/pages/admin/applications/[id]/slip.astro',
    'src/pages/admin/applications/[id]/pickup-slip.astro',
  ];
  it.each(routes)('%s styles its buttons and links large', (route) => {
    const src = readFileSync(route, 'utf8');
    expect(src).toContain('data-print');
    // every route carries the shared big-button rule
    expect(src).toMatch(/button\s*\{[^}]*font-size:\s*18px/);
  });
});
