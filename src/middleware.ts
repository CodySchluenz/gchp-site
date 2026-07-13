import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // The adapter ships an /_image proxy endpoint this site never uses; remove
  // the surface entirely rather than leave a dead proxy on a PII site.
  const res =
    context.url.pathname === '/_image'
      ? new Response('Not found', { status: 404 })
      : await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self' https://www.paypal.com; frame-ancestors 'none'; base-uri 'self'",
  );
  if (context.url.pathname.startsWith('/admin')) {
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
});
