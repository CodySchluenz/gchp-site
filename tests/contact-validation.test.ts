import { describe, it, expect } from 'vitest';
import { validateContact } from '../src/lib/validation/contact';

describe('validateContact', () => {
  it('accepts a valid message and trims values', () => {
    const r = validateContact({ name: ' Sue ', email: ' sue@example.com ', message: ' Hello ' });
    expect(r).toEqual({
      ok: true,
      spam: false,
      values: { name: 'Sue', email: 'sue@example.com', message: 'Hello' },
    });
  });

  it('flags filled honeypot as spam without errors', () => {
    const r = validateContact({ email: 'a@b.co', message: 'hi', website: 'http://spam' });
    expect(r).toEqual({ ok: true, spam: true });
  });

  it('requires email with a kind message', () => {
    const r = validateContact({ message: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toContain('email');
  });

  it('rejects a malformed email but preserves typed values', () => {
    const r = validateContact({ email: 'not-an-email', message: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBeTruthy();
      expect(r.values.message).toBe('hi');
      expect(r.values.email).toBe('not-an-email');
    }
  });

  it('requires a message', () => {
    const r = validateContact({ email: 'a@b.co', message: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.message).toBeTruthy();
  });

  it('rejects messages over 5000 characters', () => {
    const r = validateContact({ email: 'a@b.co', message: 'x'.repeat(5001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.message).toBeTruthy();
  });

  it('name is optional', () => {
    const r = validateContact({ email: 'a@b.co', message: 'hi' });
    expect(r.ok).toBe(true);
  });
});
