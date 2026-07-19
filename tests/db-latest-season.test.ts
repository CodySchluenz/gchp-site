import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, latestSeason, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('latestSeason', () => {
  it('returns the max season_year across mixed-year fixtures, ignoring soft-deleted rows', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await insertApplication(db, { ...base, seasonYear: 2025 });
      await insertApplication(db, { ...base, seasonYear: 2026 });
      const gone = await insertApplication(db, { ...base, seasonYear: 2027 });
      await db.prepare("UPDATE applications SET deleted_at='2027-01-01T00:00:00Z' WHERE id=?").bind(gone).run();
      expect(await latestSeason(db)).toBe(2026);
    } finally { await dispose(); }
  });

  it('returns null when there are no applications', async () => {
    const { db, dispose } = await getTestDb();
    try {
      expect(await latestSeason(db)).toBeNull();
    } finally { await dispose(); }
  });
});
