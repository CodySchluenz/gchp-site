import { describe, it, expect } from 'vitest';
import { suggestHouseholdType } from '../src/lib/eligibility';

const app = (ages: number[], disabled = false) => ({
  permanentlyDisabled: disabled,
  members: ages.map((age) => ({ age })),
});

// Sherlyn's rule (2026-07-30): "if father is disabled and has children under 18
// he gets regular gifts from site not cards." Children under 18 in the home make
// it a FAMILY household no matter who is disabled or elderly; cards go only to
// elderly/disabled households without children.
describe('suggestHouseholdType', () => {
  it('family when children under 18 live there, even with a disabled member', () => {
    expect(suggestHouseholdType(app([34, 7], true))).toBe('family');
  });
  it('family when a 65+ head of household is raising a grandchild', () => {
    expect(suggestHouseholdType(app([70, 5]))).toBe('family');
  });
  it('disabled when a member is disabled and no children live there', () => {
    expect(suggestHouseholdType(app([58, 55, 30], true))).toBe('disabled');
  });
  it('disabled wins over elderly when both apply (no children)', () => {
    expect(suggestHouseholdType(app([70], true))).toBe('disabled');
  });
  it('elderly when person 1 is 65+ (no children, nobody disabled)', () => {
    expect(suggestHouseholdType(app([65]))).toBe('elderly');
  });
  it('boundary: a 17-year-old is a child; an 18-year-old is not', () => {
    expect(suggestHouseholdType(app([40, 17], true))).toBe('family');
    expect(suggestHouseholdType(app([40, 18], true))).toBe('disabled');
  });
  it('family otherwise', () => {
    expect(suggestHouseholdType(app([34, 20]))).toBe('family');
  });
});
