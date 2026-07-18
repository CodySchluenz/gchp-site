import { describe, it, expect } from 'vitest';
import { validateIncomeLimits, LIMIT_FIELDS } from '../src/lib/validation/income-limits';

const good: Record<string, string> = {
  size_1: '31920', size_2: '43280', size_3: '54640', size_4: '66000',
  size_5: '77360', size_6: '88720', size_7: '100080', size_8: '111440',
  extra_person: '11360',
};

describe('validateIncomeLimits', () => {
  it('accepts plain whole numbers', () => {
    const r = validateIncomeLimits(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.limits.sizes).toEqual([31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440]);
      expect(r.limits.extraPerson).toBe(11360);
    }
  });
  it('forgives dollar signs, commas, and spaces', () => {
    const r = validateIncomeLimits({ ...good, size_1: '$31,920', size_2: ' 43 280 ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.limits.sizes[0]).toBe(31920);
  });
  it('rejects blanks with a kind message on the right field', () => {
    const r = validateIncomeLimits({ ...good, size_3: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.size_3).toContain('fill in');
  });
  it('rejects non-numbers and decimals', () => {
    const r = validateIncomeLimits({ ...good, size_5: 'abc', extra_person: '11360.50' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.size_5).toBeTruthy();
      expect(r.errors.extra_person).toBeTruthy();
    }
  });
  it('rejects zero', () => {
    const r = validateIncomeLimits({ ...good, size_1: '0' });
    expect(r.ok).toBe(false);
  });
  it('rejects an impossibly huge number with an error on that field', () => {
    const r = validateIncomeLimits({ ...good, size_2: '99999999999' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.size_2).toBeTruthy();
  });
  it('flags a limit lower than the size before it (typo guard)', () => {
    const r = validateIncomeLimits({ ...good, size_4: '5000' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.size_4).toContain('double-check');
  });
  it('LIMIT_FIELDS lists the nine form fields in order', () => {
    expect(LIMIT_FIELDS).toEqual([
      'size_1', 'size_2', 'size_3', 'size_4', 'size_5', 'size_6', 'size_7', 'size_8', 'extra_person',
    ]);
  });
});
