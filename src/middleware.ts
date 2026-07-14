import { defineMiddleware } from 'astro:middleware';
import { getSessionEmail } from './lib/auth';

// Entry points reachable without a session: the sign-in page itself and the
// magic-link verifier. Everything else under /admin requires a live session.
const PUBLIC_ADMIN = new Set(['/admin', '/admin/verify']);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname.replace(/\/$/, '') || '/';

  if (path === '/admin' || path.startsWith('/admin/')) {
    const email = await getSessionEmail(
      context.locals.runtime.env.DB,
      context.cookies.get('admin_session')?.value ?? '',
      Date.now(),
    );
    if (email) context.locals.adminEmail = email;
    if (!email && !PUBLIC_ADMIN.has(path)) {
      return context.redirect('/admin', 303);
    }
  }

  const res = context.url.pathname === '/_image' ? new Response('Not found', { status: 404 }) : await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self' https://www.paypal.com; frame-ancestors 'none'; base-uri 'self'",
  );
  if (path === '/admin' || path.startsWith('/admin/')) {
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
});
