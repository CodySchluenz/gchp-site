import type { City } from './db';

// One fixed, print-safe color per town (keyed by city id, stable year to year).
// Stragglers get black. Bands print because of print-color-adjust on the card.
export const PALETTE = [
  '#1a6b3a', '#b91c1c', '#1d4ed8', '#b45309', '#6d28d9', '#0f766e',
  '#be185d', '#4d7c0f', '#c2410c', '#0e7490', '#7c2d12', '#365314',
  '#86198f', '#1e40af', '#991b1b', '#065f46', '#92400e', '#5b21b6',
  '#155e75', '#9d174d', '#3f6212', '#7e22ce', '#166534',
];

// Rank against the FULL city list sorted by id (city ids have a gap at 21;
// ranking keeps every town on a distinct, stable color).
export function bandColorFor(cities: City[], cityId: number, straggler: boolean): string {
  if (straggler) return '#000000';
  const rank = [...cities].sort((a, b) => a.id - b.id).findIndex((c) => c.id === cityId);
  return PALETTE[(rank === -1 ? 0 : rank) % PALETTE.length];
}

export function bandLabelFor(cityName: string, straggler: boolean): string {
  return straggler ? 'STRAGGLER' : cityName;
}
