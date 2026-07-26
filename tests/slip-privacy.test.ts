import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The packing slip is VOLUNTEER-facing (2026-07-23 spec): it must never
// carry income, good deeds, notes, or bags.
// 2026-07-26: Sherlyn's packing-slip document explicitly includes gifts, doll,
// and sponsor-OK — see docs/superpowers/specs/2026-07-26-packing-slip-content-design.md.
// Income, good deeds, notes, and bags remain forbidden.
const FORBIDDEN = [
  'bags_count', 'good_deed', 'admin_notes', 'parentage_note',
  'food_share', 'social_security', 'ssi_amount',
  'child_support', 'unemployment', 'other_income', 'original_json',
];

describe('packing slip privacy', () => {
  it('SlipCard.astro contains no volunteer-forbidden fields', () => {
    const src = readFileSync('src/components/admin/SlipCard.astro', 'utf8');
    const hits = FORBIDDEN.filter((t) => src.includes(t));
    expect(hits).toEqual([]);
  });
});
