import { describe, it, expect } from 'vitest';
import { allowRequest, MemoryRateStore } from '../src/lib/rate-limit';

describe('allowRequest', () => {
  it('allows requests under the limit', async () => {
    const store = new MemoryRateStore();
    expect(await allowRequest(store, 'k', 3, 60_000, 1_000)).toBe(true);
    expect(await allowRequest(store, 'k', 3, 60_000, 2_000)).toBe(true);
    expect(await allowRequest(store, 'k', 3, 60_000, 3_000)).toBe(true);
  });

  it('blocks the request over the limit within the window', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'k', 3, 60_000, 1_000 + i);
    expect(await allowRequest(store, 'k', 3, 60_000, 5_000)).toBe(false);
  });

  it('allows again after the window has passed', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'k', 3, 60_000, 1_000 + i);
    expect(await allowRequest(store, 'k', 3, 60_000, 62_000)).toBe(true);
  });

  it('tracks keys independently', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'a', 3, 60_000, 1_000 + i);
    expect(await allowRequest(store, 'a', 3, 60_000, 5_000)).toBe(false);
    expect(await allowRequest(store, 'b', 3, 60_000, 5_000)).toBe(true);
  });
});
