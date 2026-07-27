import { describe, it, expect } from 'vitest';
import { sherlynHeaders, sherlynRow, fullHeaders, fullRow } from '../src/lib/export-columns';
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
  source: 'online',
};

describe('sherlyn sheet', () => {
  it('pins her 11 headers verbatim', () => {
    expect(sherlynHeaders(2026)).toEqual([
      'tNo', '2026 Applicant', 'Address', 'Special Gift', 'adopted', 'Thanksgiving',
      'Food Card/Cert.', 'Amount', 'Gift Cards', 'GC Amount', 'NO. in HH',
    ]);
  });
  it('maps a row: dolls fold into Special Gift, yes/blank flags, blank null amounts', () => {
    expect(sherlynRow(row)).toEqual([
      803, 'Jane Smith', '123 Oak St, Lancaster', 'Non-White doll (Sue Smith); Tim Smith: bike',
      'yes', 'yes', 'yes', 50, '', '', 3,
    ]);
  });
});

describe('full backup export', () => {
  it('has no eligibility columns and carries the new fields', () => {
    const h = fullHeaders();
    expect(h).not.toContain('Check eligibility');
    expect(h).not.toContain('Income check');
    expect(h).not.toContain('Bags');
    for (const col of ['Thanksgiving', 'Food card', 'Food card amount', 'Gift cards', 'Gift card amount', 'Dolls', 'Packing note']) {
      expect(h).toContain(col);
    }
    expect(fullRow(row)).toHaveLength(h.length);
  });
  it('maps every column to the matching field, in header order', () => {
    expect(fullRow(row)).toEqual([
      803, 'approved', centralDateTime(''), centralDateTime('2026-10-01T12:00:00Z'),
      'Jane', 'Smith', '123 Oak St', 'Lancaster', '608', 'a@b.co', 'family',
      3, 'Jane Smith (self, age 30)', 'Tim Smith: bike', 'Non-White doll (Sue Smith)', 2,
      'yes', 'none', '', '', '',
      'yes', 'yes', 50, '', '',
      '', '', '', 'online',
    ]);
  });
});
