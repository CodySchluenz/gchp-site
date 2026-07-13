import { describe, it, expect } from 'vitest';
import { newCsrfCookieValue, csrfTokenFor, verifyCsrf } from '../src/lib/csrf';

const SECRET = 'test-secret';

describe('csrf', () => {
  it('generates 64-char hex cookie values, unique per call', () => {
    const a = newCsrfCookieValue();
    const b = newCsrfCookieValue();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('verifies a token made for the same cookie and secret', async () => {
    const cookie = newCsrfCookieValue();
    const token = await csrfTokenFor(SECRET, cookie);
    expect(await verifyCsrf(SECRET, cookie, token)).toBe(true);
  });

  it('rejects a token made for a different cookie', async () => {
    const token = await csrfTokenFor(SECRET, newCsrfCookieValue());
    expect(await verifyCsrf(SECRET, newCsrfCookieValue(), token)).toBe(false);
  });

  it('rejects a token made with a different secret', async () => {
    const cookie = newCsrfCookieValue();
    const token = await csrfTokenFor('other-secret', cookie);
    expect(await verifyCsrf(SECRET, cookie, token)).toBe(false);
  });

  it('rejects empty cookie or token', async () => {
    const cookie = newCsrfCookieValue();
    const token = await csrfTokenFor(SECRET, cookie);
    expect(await verifyCsrf(SECRET, '', token)).toBe(false);
    expect(await verifyCsrf(SECRET, cookie, '')).toBe(false);
  });
});
