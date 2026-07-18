import { describe, it, expect } from 'vitest';
import {
  blockBaseFor, blockRange, STRAGGLER_BASE, MAILED_BASE, BLOCK_SIZE, NEAR_FULL_AT,
} from '../src/lib/pickup-numbers';

describe('blockBaseFor', () => {
  it('family in a town gets the town base', () => {
    expect(blockBaseFor({ householdType: 'family', straggler: false, cityBlockBase: 1600 })).toBe(1600);
  });
  it('elderly go to the mailed block regardless of town', () => {
    expect(blockBaseFor({ householdType: 'elderly', straggler: false, cityBlockBase: 1500 })).toBe(2500);
  });
  it('disabled go to the mailed block too (owner decision 2026-07-18)', () => {
    expect(blockBaseFor({ householdType: 'disabled', straggler: false, cityBlockBase: 800 })).toBe(2500);
  });
  it('a late elderly application is NOT a straggler — mailed wins', () => {
    expect(blockBaseFor({ householdType: 'elderly', straggler: true, cityBlockBase: 800 })).toBe(2500);
  });
  it('family stragglers go to 2400', () => {
    expect(blockBaseFor({ householdType: 'family', straggler: true, cityBlockBase: 100 })).toBe(2400);
  });
  it('an unseeded city (base 0) yields 0 — callers skip auto-assignment', () => {
    expect(blockBaseFor({ householdType: 'family', straggler: false, cityBlockBase: 0 })).toBe(0);
  });
});

describe('blockRange and constants', () => {
  it('a block runs base..base+99', () => {
    expect(blockRange(1600)).toEqual({ min: 1600, max: 1699 });
  });
  it('constants match the spec', () => {
    expect(STRAGGLER_BASE).toBe(2400);
    expect(MAILED_BASE).toBe(2500);
    expect(BLOCK_SIZE).toBe(100);
    expect(NEAR_FULL_AT).toBe(90);
  });
});
