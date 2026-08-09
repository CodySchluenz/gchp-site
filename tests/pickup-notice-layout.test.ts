import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The 2026-08-08 layout review (owner-approved): the mailed Pick Up Notice
// keeps Sherlyn's sentences VERBATIM (grammar changes wait for her nod) but
// gets real hierarchy and 14px type — it was the smallest print in the
// project, mailed to the oldest readers. Still three to a page.
const notice = () => readFileSync('src/components/admin/PickupNoticeCard.astro', 'utf8');

describe('pick up notice layout (2026-08-08 review)', () => {
  it('sets 14px body type, not 13px', () => {
    const src = notice();
    expect(src).toContain('font-size: 14px');
    expect(src).not.toContain('font-size: 13px');
  });

  it('gives the paper a real title block and a ruled name/ID row', () => {
    const src = notice();
    expect(src).toContain('class="org"');
    expect(src).toContain('class="doc"');
    expect(src).toContain('class="keyrow"');
  });

  it('keeps her three instruction paragraphs word for word', () => {
    const src = notice();
    for (const phrase of [
      'You must bring this slip in order to pick up your packages.',
      'Make sure there is a place to put your items in vehicle.',
      'Please clean out car prior to pick-up.',
      'Project items will not be delivered. You may send someone else to pick up your items.',
      'They must bring this slip and you must print their name and sign on back of slip that they',
      'The address is: 245 West Elm St. Lancaster WI. (Gray building',
      'DO NOT park in front of the Fire',
      'Cars will be towed.',
    ]) {
      expect(src).toContain(phrase);
    }
  });

  it('still cuts three to a page', () => {
    const src = notice();
    expect(src).toContain('nth-of-type(3n)');
    expect(src).toContain('page-break-after: always');
  });
});
