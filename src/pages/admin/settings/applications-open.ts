import type { APIRoute } from 'astro';
import { getSettings, setApplicationsOpen } from '../../../lib/db';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies, redirect }) => {
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  if (ok) {
    const current = await getSettings(locals.runtime.env.DB);
    await setApplicationsOpen(locals.runtime.env.DB, current.applications_open !== 1);
  }
  return redirect('/admin', 303);
};
