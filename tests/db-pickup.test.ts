import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  listAllPickupDays, createPickupDay, updatePickupDay,
  softDeletePickupDay, restorePickupDay, movePickupDay,
} from '../src/lib/db';

describe('pickup day admin helpers', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates, lists, updates, soft-deletes, restores, and moves', async () => {
    const a = await createPickupDay(db, { date_text: 'Mon Dec 1', description: 'Lancaster' });
    const b = await createPickupDay(db, { date_text: 'Tue Dec 2', description: 'Platteville' });
    expect((await listAllPickupDays(db)).map((r) => r.date_text)).toEqual(['Mon Dec 1', 'Tue Dec 2']);

    await updatePickupDay(db, a, { date_text: 'Mon Dec 1st', description: 'Lancaster 11-2:30' });
    expect((await listAllPickupDays(db)).find((r) => r.id === a)!.description).toBe('Lancaster 11-2:30');

    await movePickupDay(db, a, 'down');
    expect((await listAllPickupDays(db)).map((r) => r.id)).toEqual([b, a]);

    await softDeletePickupDay(db, b, '2026-10-05T00:00:00Z');
    expect((await listAllPickupDays(db)).some((r) => r.id === b)).toBe(false);
    await restorePickupDay(db, b);
    expect((await listAllPickupDays(db)).some((r) => r.id === b)).toBe(true);
  });
});
