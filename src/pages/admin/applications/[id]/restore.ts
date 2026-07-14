import type { APIRoute } from 'astro';
import { restoreApplication } from '../../../../lib/db';
import { verifyCsrf } from '../../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request, cookies, redirect }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  if (ok && Number.isInteger(id)) await restoreApplication(locals.runtime.env.DB, id);
  return redirect('/admin/applications?restored=1', 303);
};
