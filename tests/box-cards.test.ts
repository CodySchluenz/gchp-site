import { describe, it, expect } from 'vitest';
import { PALETTE, bandColorFor, bandLabelFor } from '../src/lib/box-cards';
import type { City } from '../src/lib/db';

// Real seeded city ids (migrations/0002_seed.sql, 0005_town_blocks.sql):
// 1-20, then a gap at 21, then 22-24. 23 towns total.
const CITY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24];
const cities: City[] = CITY_IDS.map((id) => ({ id, name: `Town${id}`, block_base: 0, pickup_day_id: null }));

describe('PALETTE', () => {
  it('has 23 entries', () => {
    expect(PALETTE.length).toBe(23);
  });
});

describe('bandColorFor', () => {
  it('maps all 23 seeded city ids to 23 distinct colors', () => {
    const colors = CITY_IDS.map((id) => bandColorFor(cities, id, false));
    expect(new Set(colors).size).toBe(23);
  });

  it('ids 1 and 24 get different colors (the once-fixed collision)', () => {
    expect(bandColorFor(cities, 1, false)).not.toBe(bandColorFor(cities, 24, false));
  });

  it('a straggler is always black, regardless of city', () => {
    expect(bandColorFor(cities, 1, true)).toBe('#000000');
    expect(bandColorFor(cities, 24, true)).toBe('#000000');
  });

  it('an unknown city id falls back to the first palette color rather than throwing', () => {
    expect(bandColorFor(cities, 999, false)).toBe(PALETTE[0]);
  });
});

describe('bandLabelFor', () => {
  it('returns STRAGGLER for a straggler, regardless of city name', () => {
    expect(bandLabelFor('Platteville', true)).toBe('STRAGGLER');
  });

  it('returns the city name for a non-straggler', () => {
    expect(bandLabelFor('Platteville', false)).toBe('Platteville');
  });
});
