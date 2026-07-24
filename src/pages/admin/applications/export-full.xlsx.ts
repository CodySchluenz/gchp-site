import type { APIRoute } from 'astro';
import { listApplicationsForExport, latestSeason } from '../../../lib/db';
import { buildXlsx } from '../../../lib/xlsx';
import { fullHeaders, fullRow } from '../../../lib/export-columns';

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
  const workbook = buildXlsx('Applications', fullHeaders(), rows.map(fullRow));
  // Uint8Array is a valid BodyInit at runtime; cast past the workers-types BodyInit union.
  return new Response(workbook as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="applications-full-${season}-${status}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
};
