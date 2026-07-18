// Which pickup-number block an application belongs to. Sherlyn's system
// (see docs/superpowers/specs/2026-07-18-town-blocks-design.md): each town
// owns a 100-number block (cities.block_base, first applicant = the base
// itself); stragglers get the 2400s; elderly and disabled households are
// mailed gift cards — they never go through packing — and get the 2500s.
// The 2600 "Kids without toys" block is deliberately NOT modeled: the
// operator types those few numbers by hand.

export const STRAGGLER_BASE = 2400;
export const MAILED_BASE = 2500; // elderly + disabled: mailed, never packed
export const BLOCK_SIZE = 100;
export const NEAR_FULL_AT = 90; // warn when a town has used this many numbers

export function blockBaseFor(app: {
  householdType: 'family' | 'elderly' | 'disabled';
  straggler: boolean;
  cityBlockBase: number;
}): number {
  // Mailed households outrank straggler status: stragglers are a packing
  // concept, and mailed households never go through packing.
  if (app.householdType === 'elderly' || app.householdType === 'disabled') return MAILED_BASE;
  if (app.straggler) return STRAGGLER_BASE;
  return app.cityBlockBase;
}

export function blockRange(base: number): { min: number; max: number } {
  return { min: base, max: base + BLOCK_SIZE - 1 };
}
