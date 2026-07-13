import { describe, it, expect } from 'vitest';
import { mayNotBeEligible, suggestHouseholdType } from '../src/lib/eligibility';

const app = (ages: number[], disabled = false) => ({
  permanentlyDisabled: disabled,
  members: ages.map((age) => ({ age })),
});

describe('mayNotBeEligible', () => {
  it('family with a child is eligible', () => {
    expect(mayNotBeEligible(app([34, 7]))).toBe(false);
  });
  it('senior head (65+) without children is eligible', () => {
    expect(mayNotBeEligible(app([65]))).toBe(false);
  });
  it('disabled household without children is eligible', () => {
    expect(mayNotBeEligible(app([40], true))).toBe(false);
  });
  it('under-65 adults only, not disabled: flagged', () => {
    expect(mayNotBeEligible(app([40, 42]))).toBe(true);
  });
  it('17-year-old member counts as a child', () => {
    expect(mayNotBeEligible(app([40, 17]))).toBe(false);
  });
  it('64-year-old head without children: flagged', () => {
    expect(mayNotBeEligible(app([64]))).toBe(true);
  });
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
