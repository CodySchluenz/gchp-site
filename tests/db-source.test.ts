import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, listApplicationsForExport, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('application source', () => {
  it("defaults to 'online' and honors an explicit 'paper'", async () => {
    const { db, dispose } = await getTestDb();
    try {
      const online = await insertApplication(db, base);
      const paper = await insertApplication(db, { ...base, lastName: 'Paper', source: 'paper' });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      expect(rows.find((r) => r.last_name === 'Smith')?.source).toBe('online');
      expect(rows.find((r) => r.last_name === 'Paper')?.source).toBe('paper');
      expect(online).toBeGreaterThan(0); expect(paper).toBeGreaterThan(0);
    } finally { await dispose(); }
  });
});
