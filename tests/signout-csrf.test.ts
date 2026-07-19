import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { createSession, getSessionEmail } from '../src/lib/auth';
import { newCsrfCookieValue, csrfTokenFor } from '../src/lib/csrf';
import { POST } from '../src/pages/admin/signout';

// Route-level coverage for the sign-out endpoint's CSRF guard. signout.ts
// imports 'astro' only for the APIRoute TYPE, so the handler can be invoked
// directly with a hand-built context against the real test D1 — the same
// observable contract the browser exercises: a forged cross-site POST must
// NOT end her session; her own sign-out button must.

const T0 = 1_000_000_000_000; // fixed base time
const SECRET = 'test-secret';

// Minimal stand-in for Astro's cookies API: just what the handler reads
// (get) and does (delete), with deletions recorded for assertions.
function fakeCookies(jar: Record<string, string>) {
  const deleted: string[] = [];
  return {
    deleted,
    cookies: {
      get: (name: string) => (name in jar ? { value: jar[name] } : undefined),
      delete: (name: string) => { deleted.push(name); },
    },
  };
}

function makeContext(db: D1Database, jar: Record<string, string>, formToken: string | null) {
  const form = new FormData();
  if (formToken !== null) form.set('csrf_token', formToken);
  const { deleted, cookies } = fakeCookies(jar);
  return {
    deleted,
    ctx: {
      request: new Request('http://localhost/admin/signout', { method: 'POST', body: form }),
      cookies,
      locals: { runtime: { env: { DB: db, CSRF_SECRET: SECRET } } },
      redirect: (path: string, status: number) =>
        new Response(null, { status, headers: { Location: path } }),
    } as unknown as Parameters<typeof POST>[0],
  };
}

describe('sign-out CSRF guard', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => { await dispose(); });

  it('a forged POST (wrong token) redirects but leaves the session alive', async () => {
    const sessionId = await createSession(db, 'boss@example.com', T0);
    const cookieValue = newCsrfCookieValue();
    const badToken = await csrfTokenFor(SECRET, newCsrfCookieValue()); // token for a DIFFERENT cookie
    const { ctx, deleted } = makeContext(db, { csrf: cookieValue, admin_session: sessionId }, badToken);

    const res = await POST(ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/admin');
    expect(deleted).toEqual([]); // session cookie untouched
    expect(await getSessionEmail(db, sessionId, T0 + 1000)).toBe('boss@example.com'); // still signed in
  });

  it('a forged POST (missing token) also leaves the session alive', async () => {
    const sessionId = await createSession(db, 'boss@example.com', T0);
    const { ctx, deleted } = makeContext(db, { csrf: newCsrfCookieValue(), admin_session: sessionId }, null);

    const res = await POST(ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/admin');
    expect(deleted).toEqual([]);
    expect(await getSessionEmail(db, sessionId, T0 + 1000)).toBe('boss@example.com');
  });

  it('her own sign-out (valid token) deletes the session and its cookie', async () => {
    const sessionId = await createSession(db, 'boss@example.com', T0);
    const cookieValue = newCsrfCookieValue();
    const goodToken = await csrfTokenFor(SECRET, cookieValue);
    const { ctx, deleted } = makeContext(db, { csrf: cookieValue, admin_session: sessionId }, goodToken);

    const res = await POST(ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/admin');
    expect(deleted).toEqual(['admin_session']);
    expect(await getSessionEmail(db, sessionId, T0 + 1000)).toBeNull(); // signed out
  });
});
