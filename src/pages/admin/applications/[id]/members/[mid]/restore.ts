import type { APIRoute } from 'astro';
import { restoreMember, addHistory } from '../../../../../../lib/db';
import { verifyCsrf } from '../../../../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request, cookies, redirect }) => {
  const id = Number(params.id);
  const mid = Number(params.mid);
  const base = Number.isInteger(id) ? `/admin/applications/${id}/members` : '/admin/applications';
  const form = await request.formData();
  const ok = await verifyCsrf(
    locals.runtime.env.CSRF_SECRET,
    cookies.get('csrf')?.value ?? '',
    String(form.get('csrf_token') ?? ''),
  );
  if (!ok) return redirect(`${base}?error=csrf`, 303);
  if (Number.isInteger(id) && Number.isInteger(mid)) {
    await restoreMember(locals.runtime.env.DB, mid, id);
    const m = await locals.runtime.env.DB.prepare('SELECT name FROM household_members WHERE id = ? AND application_id = ?').bind(mid, id).first<{ name: string }>();
    if (m) await addHistory(locals.runtime.env.DB, id, locals.adminEmail ?? '', 'people', `${m.name} restored`, new Date().toISOString());
  }
  return redirect(`${base}?restored=1`, 303);
};
