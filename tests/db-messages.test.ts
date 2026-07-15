import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { listContactMessages, setMessageRead, deleteContactMessage, unreadMessageCount } from '../src/lib/db';

// Insert directly so we control received_at ordering and read state.
async function seed(db: D1Database, receivedAt: string, name: string, readAt: string | null) {
  await db
    .prepare('INSERT INTO contact_messages (received_at, name, email, message, read_at) VALUES (?, ?, ?, ?, ?)')
    .bind(receivedAt, name, `${name}@x.co`, 'hi', readAt)
    .run();
}

describe('contact message admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('lists newest first, counts unread, toggles read, and deletes', async () => {
    await seed(db, '2026-11-01T10:00:00Z', 'Old', null);
    await seed(db, '2026-11-03T10:00:00Z', 'New', null);
    await seed(db, '2026-11-02T10:00:00Z', 'Mid', '2026-11-02T12:00:00Z'); // already read

    let all = await listContactMessages(db);
    expect(all.map((m) => m.name)).toEqual(['New', 'Mid', 'Old']); // newest first
    expect(await unreadMessageCount(db)).toBe(2);

    const newMsg = all.find((m) => m.name === 'New')!;
    await setMessageRead(db, newMsg.id, true, '2026-11-03T11:00:00Z');
    expect(await unreadMessageCount(db)).toBe(1);
    await setMessageRead(db, newMsg.id, false, '2026-11-03T11:00:00Z');
    expect(await unreadMessageCount(db)).toBe(2);

    const oldMsg = all.find((m) => m.name === 'Old')!;
    await deleteContactMessage(db, oldMsg.id);
    all = await listContactMessages(db);
    expect(all.map((m) => m.name)).toEqual(['New', 'Mid']);
  });
});
