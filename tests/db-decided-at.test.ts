import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, setApplicationStatus, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('decided_at', () => {
  it('is NULL on insert, stamped on approve and on deny', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      const before = await db.prepare('SELECT decided_at FROM applications WHERE id = ?').bind(a).first<{ decided_at: string | null }>();
      expect(before?.decided_at).toBeNull();
      await setApplicationStatus(db, a, 'approved');
      await setApplicationStatus(db, b, 'denied');
      const appr = await db.prepare('SELECT decided_at FROM applications WHERE id = ?').bind(a).first<{ decided_at: string | null }>();
      const den = await db.prepare('SELECT decided_at FROM applications WHERE id = ?').bind(b).first<{ decided_at: string | null }>();
      expect(appr?.decided_at).toBeTruthy();
      expect(den?.decided_at).toBeTruthy();
      expect(Number.isNaN(new Date(appr!.decided_at!).getTime())).toBe(false);
    } finally { await dispose(); }
  });
});
