import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, setApplicationStatus, listApplicationsForExport, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [
    { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
  ],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('listApplicationsForExport binds both branches', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it("runs the 'all' branch and summarizes members", async () => {
    await insertApplication(db, base);
    const rows = await listApplicationsForExport(db, 2026, 'all');
    expect(rows).toHaveLength(1);
    expect(rows[0].city_name).toBe('Lancaster');
    expect(rows[0].member_summary).toContain('Sue Smith (40)');
    expect(rows[0].member_summary).toContain('Tim Smith (7)');
  });

  it("runs a specific-status branch (binds ?1 and ?2)", async () => {
    const id = await insertApplication(db, { ...base, firstName: 'Approved' });
    await setApplicationStatus(db, id, 'approved');
    const approved = await listApplicationsForExport(db, 2026, 'approved');
    expect(approved.every((r) => r.status === 'approved')).toBe(true);
    expect(approved.some((r) => r.first_name === 'Approved')).toBe(true);
  });
});
