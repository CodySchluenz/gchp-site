import { describe, it, expect } from 'vitest';
import { centralDate, centralDateTime, centralYear } from '../src/lib/dates';

describe('central-time formatting', () => {
  it('a UTC evening lands on the previous Central day (CST, UTC-6)', () => {
    expect(centralDate('2026-12-04T02:30:00Z')).toBe('12/03/2026');
    expect(centralDateTime('2026-12-04T02:30:00Z')).toBe('12/03/2026, 8:30 PM');
  });
  it('summer uses CDT (UTC-5)', () => {
    expect(centralDateTime('2026-07-10T03:30:00Z')).toBe('07/09/2026, 10:30 PM');
  });
  it('midday stays on the same day', () => {
    expect(centralDateTime('2026-12-03T18:00:00Z')).toBe('12/03/2026, 12:00 PM');
  });
  it('empty and invalid input yield empty strings', () => {
    expect(centralDate('')).toBe('');
    expect(centralDateTime('')).toBe('');
    expect(centralDate('not-a-date')).toBe('');
    expect(centralDateTime('not-a-date')).toBe('');
  });
});

describe('centralYear', () => {
  it('reads the calendar year from the Central clock, not the server local zone', () => {
    // Dec 31 11:30pm Central (CST, UTC-6) is already Jan 1 UTC — the exact
    // window that made the old getFullYear() stamp online apps a year early.
    expect(centralYear(new Date('2027-01-01T05:30:00Z'))).toBe(2026);
  });
});
