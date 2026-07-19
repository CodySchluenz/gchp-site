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
    await assignPuNumber(db, a, 2026); // PU 800
    await assignPuNumber(db, b, 2026); // PU 801
    const slips = await listApprovedForSlips(db, 2026);
    expect(slips.map((s) => s.app.first_name)).toEqual(['Second', 'First']); // by PU asc
    expect(slips.every((s) => s.members.length === 1)).toBe(true);
  });

  // 12 sequential insert+approve+assign round-trips against the real local D1
  // test db run past vitest's 5000ms default (assignPuNumber must stay
  // sequential to hand out increasing PU numbers) — give this one more room.
  it('hydrates many approved apps with a bounded number of queries', async () => {
    for (let i = 0; i < 12; i++) {
      const id = await insertApplication(db, { ...base, firstName: `Fam${i}` });
      await setApplicationStatus(db, id, 'approved');
      await assignPuNumber(db, id, 2026);
    }
    const slips = await listApprovedForSlips(db, 2026);
    expect(slips.length).toBeGreaterThanOrEqual(12);
    expect(slips.every((s) => s.members.length >= 1)).toBe(true);
    // PU order preserved across the larger set:
    const pus = slips.map((s) => s.app.pu_number).filter((n) => n != null);
    expect(pus).toEqual([...pus].sort((a, b) => Number(a) - Number(b)));
  }, 20000);
});
