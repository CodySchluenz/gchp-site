import type { APIRoute } from 'astro';
import { listApplicationsForExport, latestSeason } from '../../../lib/db';
import { buildXlsx } from '../../../lib/xlsx';
import { centralDateTime } from '../../../lib/dates';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  // Same fallback as the applications list: param wins, then the latest
  // season with data, then the calendar year. Normally this page is reached
  // via a ?season= link from the list, so this only matters on a direct visit.
  const season = Number(url.searchParams.get('season')) || (await latestSeason(locals.runtime.env.DB)) || new Date().getFullYear();
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = (['all', 'new', 'approved', 'denied'].includes(statusParam) ? statusParam : 'all') as
    'all' | 'new' | 'approved' | 'denied';
  const search = url.searchParams.get('q') ?? '';
  const townRaw = url.searchParams.get('town') ?? '';
  const town = townRaw === 'mailed' ? ('mailed' as const) : townRaw === 'stragglers' ? ('stragglers' as const) : /^\d+$/.test(townRaw) && Number(townRaw) > 0 ? Number(townRaw) : null;
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status, search, town);
  const incomeSummary = (r: (typeof rows)[number]) => [
    ['Food Share', r.food_share_amount], ['Social Security', r.social_security_amount], ['SSI', r.ssi_amount],
    ['Child support', r.child_support_amount], ['Unemployment', r.unemployment_weekly_amount], ['Other', r.other_income_amount],
  ].filter(([, v]) => v != null).map(([k, v]) => `${k} $${v}`).join('; ');
  const headers = [
    'Pickup #', 'Status', 'Decided', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type', 'Bags',
    'People count', 'People', 'Gifts requested', 'Years received', 'Adopted last year', 'Bed', 'Bed size', 'Income', 'Jobs', 'Parentage note', 'Your notes',
    'Source',
  ];
  const data: (string | number | null)[][] = rows.map((r) => [
    r.pu_number, r.status, centralDateTime(r.decided_at ?? ''), centralDateTime(r.submitted_at), r.first_name, r.last_name, r.address,
    r.city_name, r.phone, r.email, r.household_type, r.bags_count,
    r.member_count, r.member_summary, r.gifts_summary, r.years_received_help, r.adopted_last_year === 1 ? 'yes' : '',
    r.bed_choice, r.bed_size ?? '', incomeSummary(r), r.employment_summary, r.parentage_note, r.admin_notes,
    r.source,
  ]);
  const workbook = buildXlsx('Applications', headers, data);
  // Uint8Array is a valid BodyInit at runtime; cast past the workers-types BodyInit union.
  return new Response(workbook as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="applications-${season}-${status}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
};
