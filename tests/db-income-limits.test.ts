import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { getIncomeLimits, saveIncomeLimits } from '../src/lib/db';

describe('income limits round-trip', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('reads the seeded 2026 row', async () => {
    const l = await getIncomeLimits(db, 2026);
    expect(l?.sizes).toEqual([31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440]);
    expect(l?.extraPerson).toBe(11360);
  });

  it('returns null for a season with no row', async () => {
    expect(await getIncomeLimits(db, 2031)).toBeNull();
  });

  it('inserts a new season and updates an existing one (upsert)', async () => {
    await saveIncomeLimits(db, 2027, { sizes: [1, 2, 3, 4, 5, 6, 7, 8], extraPerson: 9 });
    expect((await getIncomeLimits(db, 2027))?.sizes[0]).toBe(1);
    await saveIncomeLimits(db, 2027, { sizes: [11, 12, 13, 14, 15, 16, 17, 18], extraPerson: 19 });
    const updated = await getIncomeLimits(db, 2027);
    expect(updated?.sizes[7]).toBe(18);
    expect(updated?.extraPerson).toBe(19);
  });
});
