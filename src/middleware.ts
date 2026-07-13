import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const res = await next();
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
