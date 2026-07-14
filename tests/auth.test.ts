import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  isAllowedEmail, createLoginToken, consumeLoginToken,
  createSession, getSessionEmail, deleteSession, TOKEN_MS, SESSION_MS,
} from '../src/lib/auth';

const T0 = 1_000_000_000_000; // fixed base time

describe('auth data layer', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
    await db.prepare("INSERT INTO admin_emails (email) VALUES ('boss@example.com')").run();
  });
  afterAll(async () => { await dispose(); });

  it('recognises allow-listed emails case-insensitively, rejects others', async () => {
    expect(await isAllowedEmail(db, 'boss@example.com')).toBe(true);
    expect(await isAllowedEmail(db, '  BOSS@example.com ')).toBe(true);
    expect(await isAllowedEmail(db, 'nope@example.com')).toBe(false);
  });

  it('consumes a valid login token exactly once and returns the email', async () => {
    const token = await createLoginToken(db, 'boss@example.com', T0);
    expect(await consumeLoginToken(db, token, T0 + 1000)).toBe('boss@example.com');
    expect(await consumeLoginToken(db, token, T0 + 2000)).toBeNull(); // already used
  });

  it('rejects an expired login token', async () => {
    const token = await createLoginToken(db, 'boss@example.com', T0);
    expect(await consumeLoginToken(db, token, T0 + TOKEN_MS + 1)).toBeNull();
  });

  it('rejects an unknown login token', async () => {
    expect(await consumeLoginToken(db, 'deadbeef'.repeat(8), T0)).toBeNull();
  });

  it('creates a session, reads it back, and renews its expiry on use', async () => {
    const id = await createSession(db, 'boss@example.com', T0);
    expect(await getSessionEmail(db, id, T0 + 1000)).toBe('boss@example.com');
    // near-expiry read still valid and renews:
    expect(await getSessionEmail(db, id, T0 + SESSION_MS - 10)).toBe('boss@example.com');
    // after renewal, a time that would have been expired under the ORIGINAL expiry is still valid:
    expect(await getSessionEmail(db, id, T0 + SESSION_MS + 1000)).toBe('boss@example.com');
  });

  it('rejects an expired (unrenewed) session and an unknown session', async () => {
    const id = await createSession(db, 'boss@example.com', T0);
    expect(await getSessionEmail(db, id, T0 + SESSION_MS + 1)).toBeNull();
    expect(await getSessionEmail(db, 'nope'.repeat(16), T0)).toBeNull();
  });

  it('deletes a session (sign out)', async () => {
    const id = await createSession(db, 'boss@example.com', T0);
    await deleteSession(db, id);
    expect(await getSessionEmail(db, id, T0 + 1000)).toBeNull();
  });
});
