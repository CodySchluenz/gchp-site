import type { APIRoute } from 'astro';
import { consumeLoginToken, createSession, SESSION_MS } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url, cookies, redirect }) => {
  const token = url.searchParams.get('token') ?? '';
  const email = await consumeLoginToken(locals.runtime.env.DB, token, Date.now());
  if (!email) {
    return new Response(
      'That sign-in link has expired or was already used. Please request a fresh one.',
      { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  const sessionId = await createSession(locals.runtime.env.DB, email, Date.now());
  cookies.set('admin_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
    maxAge: Math.floor(SESSION_MS / 1000),
  });
  return redirect('/admin', 303);
};
