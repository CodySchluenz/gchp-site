import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const obj = await locals.runtime.env.FILES.get('application.pdf');
  if (!obj) {
    return new Response(
      'The paper application is not available right now. Please call 608-723-2136 ext 1194 and we will mail you one.',
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="GCHP-application.pdf"',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
