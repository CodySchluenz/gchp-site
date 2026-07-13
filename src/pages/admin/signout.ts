import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const id = cookies.get('admin_session')?.value ?? '';
  if (id) await deleteSession(locals.runtime.env.DB, id);
  cookies.delete('admin_session', { path: '/' });
  return redirect('/admin', 303);
};
