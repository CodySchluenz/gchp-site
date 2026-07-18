import { describe, it, expect } from 'vitest';
import {
  limitForSize, checkIncome, quickIncomeCheck, incomeFlagLabel,
  type IncomeLimits, type BenefitAmounts,
} from '../src/lib/income-check';

// 200% of the 2026 chart — same values migration 0004 seeds.
const LIMITS_2026: IncomeLimits = {
  sizes: [31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440],
  extraPerson: 11360,
};

const NO_BENEFITS: BenefitAmounts = {
  foodShareAmount: null, socialSecurityAmount: null, ssiAmount: null,
  childSupportAmount: null, unemploymentWeeklyAmount: null, otherIncomeAmount: null,
};

describe('limitForSize', () => {
  it('reads sizes 1 and 8 from the chart', () => {
    expect(limitForSize(1, LIMITS_2026)).toBe(31920);
    expect(limitForSize(8, LIMITS_2026)).toBe(111440);
  });
  it('adds extra_person for each person above 8', () => {
    expect(limitForSize(9, LIMITS_2026)).toBe(111440 + 11360);
    expect(limitForSize(11, LIMITS_2026)).toBe(111440 + 3 * 11360);
  });
  it('clamps size below 1 up to household of 1', () => {
    expect(limitForSize(0, LIMITS_2026)).toBe(31920);
  });
  it('returns null when no limits exist for the season', () => {
    expect(limitForSize(4, null)).toBeNull();
  });
});

describe('checkIncome', () => {
  it('annualizes each job at wage x hours x 52 and shows the math in the label', () => {
    const r = checkIncome({
      employers: [{ employerName: 'Acme', workerName: 'Pat', hourlyWage: 15.5, hoursPerWeek: 40 }],
      benefits: NO_BENEFITS, householdSize: 2,
    }, LIMITS_2026);
    expect(r.counted).toHaveLength(1);
    expect(r.counted[0].yearly).toBe(32240); // 15.50 * 40 * 52
    expect(r.counted[0].label).toContain('Acme');
    expect(r.counted[0].label).toContain('52');
    expect(r.totalYearly).toBe(32240);
  });
  it('sums multiple jobs', () => {
    const r = checkIncome({
      employers: [
        { employerName: 'Acme', workerName: 'Pat', hourlyWage: 10, hoursPerWeek: 20 },
        { employerName: 'Kwik Trip', workerName: 'Sam', hourlyWage: 12, hoursPerWeek: 10 },
      ],
      benefits: NO_BENEFITS, householdSize: 3,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(10 * 20 * 52 + 12 * 10 * 52);
  });
  it('annualizes monthly benefits x12 and weekly unemployment x52', () => {
    const r = checkIncome({
      employers: [],
      benefits: { ...NO_BENEFITS, socialSecurityAmount: 800, ssiAmount: 500, childSupportAmount: 200, otherIncomeAmount: 50, unemploymentWeeklyAmount: 300 },
      householdSize: 2,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(800 * 12 + 500 * 12 + 200 * 12 + 50 * 12 + 300 * 52);
    expect(r.counted.map((l) => l.label).join(' ')).toContain('Social Security');
  });
  it('lists FoodShare as not counted and excludes it from the total', () => {
    const r = checkIncome({
      employers: [], benefits: { ...NO_BENEFITS, foodShareAmount: 400 }, householdSize: 2,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(0);
    expect(r.counted).toHaveLength(0);
    expect(r.notCounted).toHaveLength(1);
    expect(r.notCounted[0].label).toContain('not counted');
  });
  it('skips null amounts entirely (no line)', () => {
    const r = checkIncome({ employers: [], benefits: NO_BENEFITS, householdSize: 1 }, LIMITS_2026);
    expect(r.counted).toHaveLength(0);
    expect(r.notCounted).toHaveLength(0);
    expect(r.totalYearly).toBe(0);
    expect(r.overLimit).toBe(false);
  });
  it('is NOT over when total equals the limit exactly (strictly greater)', () => {
    // household of 1, limit 31920: one job at exactly 31920/year = $15.346.. impossible;
    // use SSI 2660/mo x 12 = 31920 exactly.
    const r = checkIncome({
      employers: [], benefits: { ...NO_BENEFITS, ssiAmount: 2660 }, householdSize: 1,
    }, LIMITS_2026);
    expect(r.totalYearly).toBe(31920);
    expect(r.overLimit).toBe(false);
  });
  it('flags over when one dollar past the limit', () => {
    const r = checkIncome({
      employers: [], benefits: { ...NO_BENEFITS, otherIncomeAmount: 2661 }, householdSize: 1,
    }, LIMITS_2026); // 2661 * 12 = 31932 > 31920
    expect(r.overLimit).toBe(true);
  });
  it('returns null limit and null overLimit when the season has no limits row', () => {
    const r = checkIncome({ employers: [], benefits: NO_BENEFITS, householdSize: 4 }, null);
    expect(r.limit).toBeNull();
    expect(r.overLimit).toBeNull();
  });
  it('rounds each line to whole dollars', () => {
    const r = checkIncome({
      employers: [{ employerName: 'A', workerName: 'B', hourlyWage: 7.33, hoursPerWeek: 3 }],
      benefits: NO_BENEFITS, householdSize: 1,
    }, LIMITS_2026);
    expect(Number.isInteger(r.counted[0].yearly)).toBe(true);
    expect(r.counted[0].yearly).toBe(Math.round(7.33 * 3 * 52));
  });
});

describe('quickIncomeCheck', () => {
  it('matches checkIncome for the same inputs', () => {
    const benefits = { ...NO_BENEFITS, socialSecurityAmount: 800 };
    const full = checkIncome({
      employers: [{ employerName: 'Acme', workerName: 'Pat', hourlyWage: 15, hoursPerWeek: 40 }],
      benefits, householdSize: 3,
    }, LIMITS_2026);
    const quick = quickIncomeCheck(15 * 40 * 52, benefits, 3, LIMITS_2026);
    expect(quick.totalYearly).toBe(full.totalYearly);
    expect(quick.limit).toBe(full.limit);
    expect(quick.overLimit).toBe(full.overLimit);
  });
  it('handles missing limits', () => {
    expect(quickIncomeCheck(50000, NO_BENEFITS, 2, null).overLimit).toBeNull();
  });
  it('agrees with checkIncome on fractional multi-job totals (sum-then-round)', () => {
    const employers = [
      { employerName: 'A', workerName: 'P', hourlyWage: 12.35, hoursPerWeek: 37.5 },
      { employerName: 'B', workerName: 'Q', hourlyWage: 12.35, hoursPerWeek: 37.5 },
    ];
    const full = checkIncome({ employers, benefits: NO_BENEFITS, householdSize: 2 }, LIMITS_2026);
    const raw = employers.reduce((s, e) => s + e.hourlyWage * e.hoursPerWeek * 52, 0);
    const quick = quickIncomeCheck(raw, NO_BENEFITS, 2, LIMITS_2026);
    expect(full.totalYearly).toBe(quick.totalYearly); // 48165, not 48166
    expect(full.totalYearly).toBe(48165);
    expect(full.overLimit).toBe(quick.overLimit);
  });
});

describe('incomeFlagLabel', () => {
  it('pins the exact export strings', () => {
    expect(incomeFlagLabel(true)).toBe('over limit');
    expect(incomeFlagLabel(false)).toBe('');
    expect(incomeFlagLabel(null)).toBe('no limits set');
  });
});
