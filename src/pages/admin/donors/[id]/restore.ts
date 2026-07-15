import type { APIRoute } from 'astro';
import { restoreDonor } from '../../../../lib/db';
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
  if (!ok) return redirect('/admin/donors?error=csrf', 303);
  if (!Number.isInteger(id)) return redirect('/admin/donors', 303);
  await restoreDonor(locals.runtime.env.DB, id);
  return redirect('/admin/donors?restored=1', 303);
};
