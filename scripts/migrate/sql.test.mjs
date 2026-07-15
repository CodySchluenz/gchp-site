import { describe, it, expect } from 'vitest';
import { generateImportSql } from './sql.mjs';

describe('generateImportSql', () => {
  it('escapes apostrophes, renders NULL/numbers, and orders the tables', () => {
    const sql = generateImportSql({
      donors: [{ name: "O'Brien", contact_person: '', address: '', city: '', state: '', zip: '', phone: '', email: '' }],
      applications: [{ id: 10, season_year: 2025, status: 'approved', submitted_at: '2025-08-15T00:00:00Z', first_name: 'Sue', last_name: "O'Neil", address: '1 Elm', city_id: 13, phone: '555', email: 's@x.co', diabetic: 0, share_with_sponsor: 1, permanently_disabled: 0, bed_choice: 'blanket', bed_size: 'queen', full_time_residence_confirmed: 0, years_received_help: 0, adopted_last_year: 0, household_type: 'family', no_employment_confirmed: 0, food_share_amount: 200, social_security_amount: null, social_security_for: '', ssi_amount: null, ssi_for: '', child_support_amount: 120, child_support_for: '', unemployment_weekly_amount: null, unemployment_for: '', other_income_amount: 530, other_income_for: 'includes migrated W-2 wages', good_deed: 'Helped', may_not_be_eligible: 0 }],
      members: [{ application_id: 10, position: 1, name: 'Kid A', relationship: '', sex: 'F', age: 10, pants: '10', shirt_top: 'L', underwear: '10', socks: 'L', diapers: '', gifts: 'books' }],
      employers: [{ application_id: 10, employer_name: 'Acme', worker_name: 'Sue O\'Neil', hourly_wage: 15, hours_per_week: 40 }],
    });
    // Escaping
    expect(sql).toContain("'O''Brien'");
    expect(sql).toContain("'O''Neil'");
    // NULL and numbers unquoted
    expect(sql).toContain('NULL');
    expect(sql).toContain('200');
    // Preserved id + ordering (donors before applications before members before employers)
    expect(sql.indexOf('INSERT INTO donors')).toBeLessThan(sql.indexOf('INSERT INTO applications'));
    expect(sql.indexOf('INSERT INTO applications')).toBeLessThan(sql.indexOf('INSERT INTO household_members'));
    expect(sql.indexOf('INSERT INTO household_members')).toBeLessThan(sql.indexOf('INSERT INTO employers'));
    expect(sql).toContain('INSERT INTO applications (id,');
  });

  it('emits nothing for empty groups', () => {
    expect(generateImportSql({ donors: [], applications: [], members: [], employers: [] })).toBe('');
  });
});
