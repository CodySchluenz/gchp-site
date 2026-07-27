// The two Excel downloads, as pure header/row mappers so the routes stay
// thin and the exact columns are pinned by tests/export-columns.test.ts.
// The primary sheet is EXACTLY the working spreadsheet Sherlyn keeps by
// hand (her column titles, verbatim); the full export is the everything-
// backup used before purging a season and for the next maintainer.
import type { ExportRow } from './db';
import { centralDateTime } from './dates';

const yes = (v: number) => (v === 1 ? 'yes' : '');

export function sherlynHeaders(season: number): string[] {
  return [
    'tNo', `${season} Applicant`, 'Address', 'Special Gift', 'adopted', 'Thanksgiving',
    'Food Card/Cert.', 'Amount', 'Gift Cards', 'GC Amount', 'NO. in HH',
  ];
}

export function sherlynRow(r: ExportRow): (string | number | null)[] {
  const specialGift = [r.dolls_summary, r.gifts_summary].filter(Boolean).join('; ');
  return [
    r.pu_number, `${r.first_name} ${r.last_name}`, `${r.address}, ${r.city_name}`, specialGift,
    yes(r.adopted_last_year), yes(r.thanksgiving_card),
    yes(r.food_card), r.food_card_amount ?? '', yes(r.gift_card), r.gift_card_amount ?? '',
    r.member_count,
  ];
}

export function fullHeaders(): string[] {
  return [
    'Pickup #', 'Status', 'Decided', 'Applied', 'First name', 'Last name', 'Address', 'Town',
    'Phone', 'Email', 'Household type',
    'People count', 'People', 'Gifts requested', 'Dolls', 'Years received', 'Adopted last year',
    'Bed', 'Bed size', 'Income', 'Jobs',
    'Thanksgiving', 'Food card', 'Food card amount', 'Gift cards', 'Gift card amount',
    'Packing note', 'Parentage note', 'Your notes', 'Source',
  ];
}

export function fullRow(r: ExportRow): (string | number | null)[] {
  const income = [
    ['Food Share', r.food_share_amount], ['Social Security', r.social_security_amount], ['SSI', r.ssi_amount],
    ['Child support', r.child_support_amount], ['Unemployment', r.unemployment_weekly_amount], ['Other', r.other_income_amount],
  ].filter(([, v]) => v != null).map(([k, v]) => `${k} $${v}`).join('; ');
  return [
    r.pu_number, r.status, centralDateTime(r.decided_at ?? ''), centralDateTime(r.submitted_at),
    r.first_name, r.last_name, r.address, r.city_name, r.phone, r.email, r.household_type,
    r.member_count, r.member_summary, r.gifts_summary, r.dolls_summary, r.years_received_help,
    yes(r.adopted_last_year), r.bed_choice, r.bed_size ?? '', income, r.employment_summary,
    yes(r.thanksgiving_card), yes(r.food_card), r.food_card_amount ?? '', yes(r.gift_card), r.gift_card_amount ?? '',
    r.packing_note, r.parentage_note, r.admin_notes, r.source,
  ];
}
