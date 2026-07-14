import { newSecret, sha256Hex } from './auth-crypto';

export const TOKEN_MS = 15 * 60 * 1000;
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const iso = (ms: number) => new Date(ms).toISOString();

export async function isAllowedEmail(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM admin_emails WHERE lower(email) = lower(?)')
    .bind(email.trim())
    .first<{ ok: number }>();
  return row !== null;
}

export async function createLoginToken(db: D1Database, email: string, now: number): Promise<string> {
  const token = newSecret();
  await db
    .prepare('INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), email.trim(), iso(now + TOKEN_MS))
    .run();
  return token;
}

export async function consumeLoginToken(
  db: D1Database,
  rawToken: string,
  now: number,
): Promise<string | null> {
  // One atomic statement: claim the token only if it is unused and unexpired.
  // RETURNING makes the winning claimer the only caller that gets the email,
  // so two racing sign-in clicks (or a scanner + a human) can't both succeed.
  const nowIso = iso(now);
  const row = await db
    .prepare(
      `UPDATE login_tokens SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?
       RETURNING email`,
    )
    .bind(nowIso, await sha256Hex(rawToken), nowIso)
    .first<{ email: string }>();
  return row?.email ?? null;
}

export async function createSession(db: D1Database, email: string, now: number): Promise<string> {
  const id = newSecret();
  await db
    .prepare('INSERT INTO sessions (session_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(id), email.trim(), iso(now), iso(now + SESSION_MS))
    .run();
  return id;
}

export async function getSessionEmail(
  db: D1Database,
  rawSessionId: string,
  now: number,
): Promise<string | null> {
  const hash = await sha256Hex(rawSessionId);
  const row = await db
    .prepare('SELECT email, expires_at FROM sessions WHERE session_hash = ?')
    .bind(hash)
    .first<{ email: string; expires_at: string }>();
  if (!row || Date.parse(row.expires_at) < now) return null;
  await db
    .prepare('UPDATE sessions SET expires_at = ? WHERE session_hash = ?')
    .bind(iso(now + SESSION_MS), hash)
    .run();
  return row.email;
}

export async function deleteSession(db: D1Database, rawSessionId: string): Promise<void> {
  await db
    .prepare('DELETE FROM sessions WHERE session_hash = ?')
    .bind(await sha256Hex(rawSessionId))
    .run();
}
