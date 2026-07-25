import type { APIRoute } from 'astro';
import { restoreEmployer, addHistory } from '../../../../../../lib/db';
import { verifyCsrf } from '../../../../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request, cookies, redirect }) => {
  const id = Number(params.id);
  const eid = Number(params.eid);
  const base = Number.isInteger(id) ? `/admin/applications/${id}/employers` : '/admin/applications';
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  if (!ok) return redirect(`${base}?error=csrf`, 303);
  if (Number.isInteger(id) && Number.isInteger(eid)) {
    await restoreEmployer(locals.runtime.env.DB, eid, id);
    const e = await locals.runtime.env.DB.prepare('SELECT employer_name FROM employers WHERE id = ? AND application_id = ?').bind(eid, id).first<{ employer_name: string }>();
    if (e) await addHistory(locals.runtime.env.DB, id, locals.adminEmail ?? '', 'jobs', `Job at ${e.employer_name} restored`, new Date().toISOString());
  }
  return redirect(`${base}?restored=1`, 303);
};
