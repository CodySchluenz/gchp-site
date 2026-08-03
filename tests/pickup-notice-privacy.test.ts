import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The Pick Up Notice is MAILED TO THE FAMILY and travels in the world
// (spec 2026-07-26 Addendum 2, built 2026-07-31 from Sherlyn's own form
// "Regular pickup slips"): it carries ONLY the name, the ID# (pickup
// number), the pickup day, and her fixed instructions/location text.
// Never household data — no members, sizes, gifts, income, notes, or the
// family's own address/phone/email (tokens are property accesses, since
// the location paragraph legitimately contains the word "address").
const FORBIDDEN = [
  'members', 'gifts', 'doll', 'pants', 'shirt_top', 'underwear', 'socks', 'diapers',
  'good_deed', 'admin_notes', 'packing_note', 'diabetic', 'bed_',
  'food_share', 'social_security', 'ssi', 'child_support', 'unemployment', 'other_income',
  'a.address', 'a.phone', 'a.email', 'original_json',
];

describe('pick up notice privacy', () => {
  it('PickupNoticeCard.astro contains only name, number, day, and the fixed text', () => {
    const src = readFileSync('src/components/admin/PickupNoticeCard.astro', 'utf8');
    const hits = FORBIDDEN.filter((t) => src.includes(t));
    expect(hits).toEqual([]);
  });
});
