import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The packing slip is VOLUNTEER-facing (2026-07-23 spec): it must never
// carry income, good deeds, notes, or bags.
// 2026-07-26: Sherlyn's packing-slip document explicitly includes gifts, doll,
// and sponsor-OK — see docs/superpowers/specs/2026-07-26-packing-slip-content-design.md.
// Income, good deeds, notes, and bags remain forbidden.
// 2026-07-26 Addendum 3 (same spec): `packing_note` is a NEW field on the slip,
// deliberately volunteer-visible (typed by Sherlyn, labeled "Note for packers").
// It is NOT admin_notes and does not collide with any token below — the
// FORBIDDEN list itself is unchanged by this addendum.
// 2026-07-31 (Sherlyn, resolving the 07-30 gifts removal): gifts are BACK ON
// the slip — "where can I print off list that states actual gifts they are to
// pack? I wanted to add or delete items." The slip's gifts column is her
// CURATED pack list: she edits each person's "Gifts / toys wanted" under Edit
// household members (swapping anything she's out of), then prints. The raw
// family ask and the final pack list are the same field, by design.
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
