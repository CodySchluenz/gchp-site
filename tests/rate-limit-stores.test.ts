import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { allowRequest, MemoryRateStore, D1RateStore } from '../src/lib/rate-limit';
import { getTestDb } from './helpers/d1';

describe('fixed window boundary', () => {
  it('allows again exactly at windowStart + windowMs', async () => {
    const store = new MemoryRateStore();
    for (let i = 0; i < 3; i++) await allowRequest(store, 'k', 3, 60_000, 1_000);
    // 60_999 is still inside the window opened at 1_000; 61_000 is exactly the boundary.
    expect(await allowRequest(store, 'k', 3, 60_000, 60_999)).toBe(false);
    expect(await allowRequest(store, 'k', 3, 60_000, 61_000)).toBe(true);
  });
});

describe('D1RateStore against real local D1', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it('persists and updates records through the real rate_limits table', async () => {
    const store = new D1RateStore(db);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 1_000)).toBe(true);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 2_000)).toBe(true);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 3_000)).toBe(false);
    expect(await allowRequest(store, 'ip1', 2, 60_000, 61_000)).toBe(true); // window reset
    const row = await db
      .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
      .bind('ip1')
      .first<{ window_start: number; count: number }>();
    expect(row).toEqual({ window_start: 61_000, count: 1 });
  });
});
