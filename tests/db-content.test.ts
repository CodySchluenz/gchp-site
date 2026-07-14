import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  listAllContentBlocks, createContentBlock, updateContentBlock,
  softDeleteContentBlock, restoreContentBlock, moveContentBlock,
} from '../src/lib/db';

describe('content block admin helpers', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates blocks appended in order and lists them', async () => {
    const a = await createContentBlock(db, { title: 'A', subtitle: 'a', body: 'aa' });
    const b = await createContentBlock(db, { title: 'B', subtitle: 'b', body: 'bb' });
    const rows = await listAllContentBlocks(db);
    expect(rows.map((r) => r.title)).toEqual(['A', 'B']);
    expect(rows[0].sort_order).toBeLessThan(rows[1].sort_order);
    expect([a, b].every((id) => id > 0)).toBe(true);
  });

  it('updates a block', async () => {
    const id = await createContentBlock(db, { title: 'X', subtitle: '', body: '' });
    await updateContentBlock(db, id, { title: 'X2', subtitle: 's', body: 'y' });
    const row = (await listAllContentBlocks(db)).find((r) => r.id === id)!;
    expect([row.title, row.subtitle, row.body]).toEqual(['X2', 's', 'y']);
  });

  it('soft-deletes and restores', async () => {
    const id = await createContentBlock(db, { title: 'Gone', subtitle: '', body: '' });
    await softDeleteContentBlock(db, id, '2026-10-05T00:00:00Z');
    expect((await listAllContentBlocks(db)).some((r) => r.id === id)).toBe(false);
    await restoreContentBlock(db, id);
    expect((await listAllContentBlocks(db)).some((r) => r.id === id)).toBe(true);
  });

  it('moves a block up and down, renumbering cleanly', async () => {
    const { db: db2, dispose: d2 } = await getTestDb();
    try {
      const first = await createContentBlock(db2, { title: 'First', subtitle: '', body: '' });
      await createContentBlock(db2, { title: 'Second', subtitle: '', body: '' });
      await createContentBlock(db2, { title: 'Third', subtitle: '', body: '' });
      await moveContentBlock(db2, first, 'down');
      expect((await listAllContentBlocks(db2)).map((r) => r.title)).toEqual(['Second', 'First', 'Third']);
      await moveContentBlock(db2, first, 'up');
      expect((await listAllContentBlocks(db2)).map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
      // no-op past the top:
      await moveContentBlock(db2, first, 'up');
      expect((await listAllContentBlocks(db2)).map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
    } finally {
      await d2();
    }
  });
});
