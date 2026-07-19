import type { APIRoute } from 'astro';
import { listApplicationsForExport, getIncomeLimits } from '../../../lib/db';
import { buildXlsx } from '../../../lib/xlsx';
import { quickIncomeCheck, incomeFlagLabel, type BenefitAmounts } from '../../../lib/income-check';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const season = Number(url.searchParams.get('season')) || new Date().getFullYear();
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = (['all', 'new', 'approved', 'denied'].includes(statusParam) ? statusParam : 'all') as
    'all' | 'new' | 'approved' | 'denied';
  const search = url.searchParams.get('q') ?? '';
  const townRaw = url.searchParams.get('town') ?? '';
  const town = townRaw === 'mailed' ? ('mailed' as const) : /^\d+$/.test(townRaw) && Number(townRaw) > 0 ? Number(townRaw) : null;
  const rows = await listApplicationsForExport(locals.runtime.env.DB, season, status, search, town);
  const incomeSummary = (r: (typeof rows)[number]) => [
    ['Food Share', r.food_share_amount], ['Social Security', r.social_security_amount], ['SSI', r.ssi_amount],
    ['Child support', r.child_support_amount], ['Unemployment', r.unemployment_weekly_amount], ['Other', r.other_income_amount],
  ].filter(([, v]) => v != null).map(([k, v]) => `${k} $${v}`).join('; ');
  const limits = await getIncomeLimits(locals.runtime.env.DB, season);
  const incomeFlag = (r: (typeof rows)[number]): string => {
    const benefits: BenefitAmounts = {
      foodShareAmount: r.food_share_amount, socialSecurityAmount: r.social_security_amount,
      ssiAmount: r.ssi_amount, childSupportAmount: r.child_support_amount,
      unemploymentWeeklyAmount: r.unemployment_weekly_amount, otherIncomeAmount: r.other_income_amount,
    };
    const q = quickIncomeCheck(r.employment_yearly, benefits, r.member_count, limits);
    return incomeFlagLabel(q.overLimit);
  };
  const headers = [
    'Pickup #', 'Status', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type', 'Check eligibility', 'Bags',
    'People count', 'People', 'Years received', 'Adopted last year', 'Bed', 'Bed size', 'Income', 'Jobs', 'Income check', 'Parentage note', 'Your notes',
  ];
  const data: (string | number | null)[][] = rows.map((r) => [
    r.pu_number, r.status, r.submitted_at.slice(0, 10), r.first_name, r.last_name, r.address,
    r.city_name, r.phone, r.email, r.household_type, r.may_not_be_eligible === 1 ? 'yes' : '', r.bags_count,
    r.member_count, r.member_summary, r.years_received_help, r.adopted_last_year === 1 ? 'yes' : '',
    r.bed_choice, r.bed_size ?? '', incomeSummary(r), r.employment_summary, incomeFlag(r), r.parentage_note, r.admin_notes,
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
