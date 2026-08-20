import type { APIRoute } from 'astro';
import { listApplicationsForExport, latestSeason } from '../../../lib/db';
import { buildXlsxWorkbook } from '../../../lib/xlsx';
import { sherlynHeaders, sherlynRow, townSheets } from '../../../lib/export-columns';

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
  const town = townRaw === 'mailed' ? ('mailed' as const) : townRaw === 'stragglers' ? ('stragglers' as const) : townRaw === 'adopted' ? ('adopted' as const) : /^\d+$/.test(townRaw) && Number(townRaw) > 0 ? Number(townRaw) : null;
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status, search, town);
  const headers = sherlynHeaders(season);
  // Column 4 (Special Gift) downloads blank for the coordinator to fill in —
  // hold it at a generous 22 characters so she has room to type; every other
  // column auto-sizes to its content inside the writer.
  const widths: (number | undefined)[] = [];
  widths[headers.indexOf('Special Gift')] = 22;
  // "All towns" (no town picked) splits into one worksheet per town —
  // Lancaster on its own tab, Fennimore on its own tab, and so on
  // (Sherlyn, 2026-08-19). A specific view stays a single sheet.
  const sheets = town === null && rows.length > 0
    ? townSheets(rows).map((t) => ({ name: t.name, headers, rows: t.rows.map(sherlynRow), widthOverrides: widths }))
    : [{ name: 'Applications', headers, rows: rows.map(sherlynRow), widthOverrides: widths }];
  const workbook = buildXlsxWorkbook(sheets);
  // Uint8Array is a valid BodyInit at runtime; cast past the workers-types BodyInit union.
  return new Response(workbook as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="applications-${season}-${status}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
};
