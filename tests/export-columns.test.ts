import { describe, it, expect } from 'vitest';
import { sherlynHeaders, sherlynRow, fullHeaders, fullRow, townSheets, regularPickupRows } from '../src/lib/export-columns';
import { centralDateTime } from '../src/lib/dates';
import type { ExportRow } from '../src/lib/db';

const row: ExportRow = {
  pu_number: 803, status: 'approved', submitted_at: '2026-10-01T12:00:00Z', decided_at: null,
  first_name: 'Jane', last_name: 'Smith', address: '123 Oak St', city_name: 'Lancaster',
  phone: '608', email: 'a@b.co', household_type: 'family',
  parentage_note: '', admin_notes: '', packing_note: '', years_received_help: 2, adopted_last_year: 1,
  bed_choice: 'none', bed_size: null, food_share_amount: null, social_security_amount: null,
  ssi_amount: null, child_support_amount: null, unemployment_weekly_amount: null, other_income_amount: null,
  member_count: 3, member_summary: 'Jane Smith (self, age 30)', gifts_summary: 'Tim Smith: bike',
  dolls_summary: 'Non-White doll (Sue Smith)', employment_summary: '',
  thanksgiving_card: 1, food_card: 1, food_card_amount: 50, gift_card: 0, gift_card_amount: null,
  source: 'online', straggler: 0,
  adopted: 0, adopter_name: '', adopter_contact: '', adopter_phone: '', adopter_address: '',
};

const adoptedRow: ExportRow = {
  ...row,
  adopted: 1, adopter_name: 'Platteville Kiwanis', adopter_contact: 'Jo Doe',
  adopter_phone: '608-555-0100', adopter_address: '1 Main St',
};

describe('sherlyn sheet', () => {
  it('pins her 12 headers verbatim — Adopted by inserted directly after adopted', () => {
    expect(sherlynHeaders(2026)).toEqual([
      'tNo', '2026 Applicant', 'Address', 'Special Gift', 'adopted', 'Adopted by', 'Thanksgiving',
      'Food Card/Cert.', 'Amount', 'Gift Cards', 'GC Amount', 'NO. in HH',
    ]);
  });
  // Sherlyn 2026-08-19: Special Gift stays BLANK on the download — she fills
  // it in herself later. Dolls/gifts still live on packing slips, the detail
  // page, and the full backup export.
  // Sherlyn 2026-09: the 'adopted' column means marked adopted THIS season
  // (adopted_last_year no longer shows on her sheet — adoptees get different
  // families each year; the fixture's adopted_last_year: 1 must NOT leak in).
  it('maps a row: Special Gift blank for her to fill in, adopted blank until marked this season, blank null amounts', () => {
    expect(sherlynRow(row)).toEqual([
      803, 'Jane Smith', '123 Oak St, Lancaster', '',
      '', '', 'yes', 'yes', 50, '', '', 3,
    ]);
  });
  // Sherlyn 2026-08-19/2026-09: once marked adopted this season, the adopted
  // column says yes and Adopted by carries who to reach — name AND phone.
  it('adopted + Adopted by both key on the this-season mark', () => {
    expect(sherlynRow(adoptedRow)).toEqual([
      803, 'Jane Smith', '123 Oak St, Lancaster', '',
      'yes', 'Platteville Kiwanis — 608-555-0100', 'yes', 'yes', 50, '', '', 3,
    ]);
  });
  it('Adopted by shows just the name when no adopter phone was recorded', () => {
    expect(sherlynRow({ ...adoptedRow, adopter_phone: '' })[5]).toBe('Platteville Kiwanis');
  });
});

// Sherlyn 2026-09: the town tabs of the All-towns workbook hold regular
// pickup families only — mailed (elderly/disabled) households and stragglers
// come from their own views instead (owner-confirmed: no extra tabs).
describe('regularPickupRows', () => {
  it('drops mailed households and stragglers, keeps regular and adopted-out families', () => {
    const fam = { ...row, pu_number: 101 };
    const eld = { ...row, pu_number: 2500, household_type: 'elderly' };
    const dis = { ...row, pu_number: 2501, household_type: 'disabled' };
    const strag = { ...row, pu_number: 2400, straggler: 1 };
    const adoptedOut = { ...adoptedRow, pu_number: 102 };
    expect(regularPickupRows([fam, eld, dis, strag, adoptedOut]).map((r) => r.pu_number)).toEqual([101, 102]);
  });
});

// 2026-08-19 (Sherlyn): the "All towns" download gets one worksheet per town.
describe('townSheets', () => {
  it('groups rows by town, alphabetically, preserving each town\'s row order', () => {
    const lan1 = { ...row, city_name: 'Lancaster', pu_number: 101 };
    const fen1 = { ...row, city_name: 'Fennimore', pu_number: 803 };
    const lan2 = { ...row, city_name: 'Lancaster', pu_number: 102 };
    const sheets = townSheets([lan1, fen1, lan2]);
    expect(sheets.map((s) => s.name)).toEqual(['Fennimore', 'Lancaster']);
    expect(sheets[0].rows.map((r) => r.pu_number)).toEqual([803]);
    expect(sheets[1].rows.map((r) => r.pu_number)).toEqual([101, 102]);
  });
});

describe('full backup export', () => {
  it('has no eligibility columns and carries the new fields', () => {
    const h = fullHeaders();
    expect(h).not.toContain('Check eligibility');
    expect(h).not.toContain('Income check');
    expect(h).not.toContain('Bags');
    for (const col of [
      'Thanksgiving', 'Food card', 'Food card amount', 'Gift cards', 'Gift card amount', 'Dolls', 'Packing note',
      'Adopted out', 'Adopted by', 'Adopter contact', 'Adopter phone', 'Adopter address',
    ]) {
      expect(h).toContain(col);
    }
    expect(fullRow(row)).toHaveLength(h.length);
  });
  it('maps every column to the matching field, in header order — adoption block is blank when not adopted', () => {
    expect(fullRow(row)).toEqual([
      803, 'approved', centralDateTime(''), centralDateTime('2026-10-01T12:00:00Z'),
      'Jane', 'Smith', '123 Oak St', 'Lancaster', '608', 'a@b.co', 'family',
      3, 'Jane Smith (self, age 30)', 'Tim Smith: bike', 'Non-White doll (Sue Smith)', 2,
      'yes', '', '', '', '', '',
      'none', '', '', '',
      'yes', 'yes', 50, '', '',
      '', '', '', 'online',
    ]);
  });
  it('carries the adoption block once adopted — stale fields never show when un-marked (pinned above)', () => {
    expect(fullRow(adoptedRow)).toEqual([
      803, 'approved', centralDateTime(''), centralDateTime('2026-10-01T12:00:00Z'),
      'Jane', 'Smith', '123 Oak St', 'Lancaster', '608', 'a@b.co', 'family',
      3, 'Jane Smith (self, age 30)', 'Tim Smith: bike', 'Non-White doll (Sue Smith)', 2,
      'yes', 'yes', 'Platteville Kiwanis', 'Jo Doe', '608-555-0100', '1 Main St',
      'none', '', '', '',
      'yes', 'yes', 50, '', '',
      '', '', '', 'online',
    ]);
  });
});
