import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, assignPuNumber, setApplicationStatus, listApprovedForSlips, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('listApprovedForSlips', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('returns only approved apps for the season, ordered by PU number, with members', async () => {
    const a = await insertApplication(db, { ...base, firstName: 'Second' });
    const b = await insertApplication(db, { ...base, firstName: 'First' });
    await insertApplication(db, { ...base, firstName: 'NotApproved' }); // stays 'new'
    await setApplicationStatus(db, a, 'approved');
    await setApplicationStatus(db, b, 'approved');
    await assignPuNumber(db, a, 2026); // PU 1
    await assignPuNumber(db, b, 2026); // PU 2
    const slips = await listApprovedForSlips(db, 2026);
    expect(slips.map((s) => s.app.first_name)).toEqual(['Second', 'First']); // by PU asc
    expect(slips.every((s) => s.members.length === 1)).toBe(true);
  });
});
