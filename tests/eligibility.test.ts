import { describe, it, expect } from 'vitest';
import { suggestHouseholdType } from '../src/lib/eligibility';

const app = (ages: number[], disabled = false) => ({
  permanentlyDisabled: disabled,
  members: ages.map((age) => ({ age })),
});

describe('suggestHouseholdType', () => {
  it('disabled wins over everything', () => {
    expect(suggestHouseholdType(app([70, 5], true))).toBe('disabled');
  });
  it('elderly when person 1 is 65+', () => {
    expect(suggestHouseholdType(app([65]))).toBe('elderly');
  });
  it('family otherwise', () => {
    expect(suggestHouseholdType(app([34, 7]))).toBe('family');
  });
});
