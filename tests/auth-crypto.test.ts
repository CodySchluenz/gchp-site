import { describe, it, expect } from 'vitest';
import { newSecret, sha256Hex } from '../src/lib/auth-crypto';

describe('newSecret', () => {
  it('is 64 hex chars and unique per call', () => {
    const a = newSecret();
    const b = newSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('sha256Hex', () => {
  it('produces the known digest for a known input', async () => {
    // SHA-256("abc")
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('is deterministic and differs for different inputs', async () => {
    expect(await sha256Hex('x')).toBe(await sha256Hex('x'));
    expect(await sha256Hex('x')).not.toBe(await sha256Hex('y'));
  });
});
