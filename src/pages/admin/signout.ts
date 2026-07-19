import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/auth';
import { verifyCsrf } from '../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies, redirect }) => {
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  // On a bad/missing token, do nothing rather than sign her out unexpectedly
  // — never strand her mid-task over a stale token.
  if (!ok) return redirect('/admin', 303);
  const id = cookies.get('admin_session')?.value ?? '';
  if (id) await deleteSession(locals.runtime.env.DB, id);
  cookies.delete('admin_session', { path: '/' });
  return redirect('/admin', 303);
};
