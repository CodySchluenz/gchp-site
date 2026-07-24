import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The packing slip is VOLUNTEER-facing (2026-07-23 spec): it must never
// carry income, good deeds, notes, sponsor status, bags, or gifts.
const FORBIDDEN = [
  'bags_count', 'gifts', 'good_deed', 'admin_notes', 'parentage_note',
  'share_with_sponsor', 'food_share', 'social_security', 'ssi_amount',
  'child_support', 'unemployment', 'other_income',
];

describe('packing slip privacy', () => {
  it('SlipCard.astro contains no volunteer-forbidden fields', () => {
    const src = readFileSync('src/components/admin/SlipCard.astro', 'utf8');
    const hits = FORBIDDEN.filter((t) => src.includes(t));
    expect(hits).toEqual([]);
  });
});
