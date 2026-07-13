// Fixed-window rate limiting behind a tiny store interface so the logic is
// unit-testable in memory and backed by D1 in production.

export type RateRecord = { windowStart: number; count: number };

export interface RateStore {
  get(key: string): Promise<RateRecord | null>;
  set(key: string, v: RateRecord): Promise<void>;
}

export async function allowRequest(
  store: RateStore,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<boolean> {
  const rec = await store.get(key);
  if (!rec || now - rec.windowStart >= windowMs) {
    await store.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (rec.count >= limit) return false;
  await store.set(key, { windowStart: rec.windowStart, count: rec.count + 1 });
  return true;
}

export class MemoryRateStore implements RateStore {
  private map = new Map<string, RateRecord>();
  async get(key: string): Promise<RateRecord | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, v: RateRecord): Promise<void> {
    this.map.set(key, v);
  }
}

export class D1RateStore implements RateStore {
  constructor(private db: D1Database) {}
  async get(key: string): Promise<RateRecord | null> {
    const row = await this.db
      .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ window_start: number; count: number }>();
    return row ? { windowStart: row.window_start, count: row.count } : null;
  }
  async set(key: string, v: RateRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`,
      )
      .bind(key, v.windowStart, v.count)
      .run();
  }
}
