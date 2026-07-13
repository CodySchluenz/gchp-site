import type { APIRoute } from 'astro';
import { listApplicationsForExport } from '../../../lib/db';
import { toCsv } from '../../../lib/csv';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const season = Number(url.searchParams.get('season')) || new Date().getFullYear();
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = (['all', 'new', 'approved', 'denied'].includes(statusParam) ? statusParam : 'all') as
    'all' | 'new' | 'approved' | 'denied';
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status);
  const headers = [
    'Pickup #', 'Status', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type', 'Check eligibility', 'Bags', 'People',
  ];
  const body = toCsv(
    headers,
    rows.map((r) => [
      r.pu_number, r.status, r.submitted_at.slice(0, 10), r.first_name, r.last_name, r.address,
      r.city_name, r.phone, r.email, r.household_type, r.may_not_be_eligible === 1 ? 'yes' : '', r.bags_count, r.member_summary,
    ]),
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="applications-${season}-${status}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
