import { describe, it, expect } from 'vitest';
import { centralDate, centralDateTime } from '../src/lib/dates';

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
