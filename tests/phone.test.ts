import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatPhone } from '../src/lib/phone';

// Sherlyn 2026-09-02: packing-slip phone numbers read "608 988-4079" — easier
// for the volunteers to remember while dialing. Applicants type phones every
// which way; formatPhone normalizes the recognizable shapes and leaves
// anything unusual exactly as typed (house rule: never mangle their input).
describe('formatPhone', () => {
  it('formats a bare 10-digit number her way', () => {
    expect(formatPhone('6089884079')).toBe('608 988-4079');
  });
  it('reformats common typed shapes', () => {
    expect(formatPhone('608-988-4079')).toBe('608 988-4079');
    expect(formatPhone('(608) 988-4079')).toBe('608 988-4079');
    expect(formatPhone('608.988.4079')).toBe('608 988-4079');
    expect(formatPhone('608 988 4079')).toBe('608 988-4079');
  });
  it('drops a leading 1 from an 11-digit number', () => {
    expect(formatPhone('1-608-988-4079')).toBe('608 988-4079');
  });
  it('formats a 7-digit local number', () => {
    expect(formatPhone('9884079')).toBe('988-4079');
  });
  it('leaves anything unusual exactly as typed', () => {
    expect(formatPhone('608-988-4079 ext 2')).toBe('608-988-4079 ext 2');
    expect(formatPhone('call after 5')).toBe('call after 5');
    expect(formatPhone('')).toBe('');
  });
});

describe('packing slip uses the formatted phone', () => {
  it('SlipCard renders the phone through formatPhone', () => {
    const src = readFileSync('src/components/admin/SlipCard.astro', 'utf8');
    expect(src).toContain('formatPhone');
    expect(src).not.toContain('{a.phone}');
  });
});
