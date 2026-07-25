import type { APIRoute } from 'astro';
import { restoreApplication, addHistory } from '../../../../lib/db';
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
  if (!ok) return redirect('/admin/applications?error=csrf', 303);
  if (Number.isInteger(id)) {
    await restoreApplication(locals.runtime.env.DB, id);
    await addHistory(locals.runtime.env.DB, id, locals.adminEmail ?? '', 'record', 'Application restored', new Date().toISOString());
  }
  return redirect('/admin/applications?restored=1', 303);
};
