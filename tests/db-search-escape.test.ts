import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, listApplications, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('name search LIKE escaping', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('treats % as a literal, not a wildcard', async () => {
    await insertApplication(db, { ...base, lastName: 'Per%cent' });
    await insertApplication(db, { ...base, lastName: 'Percent' });
    const hits = await listApplications(db, 2026, 'all', '%');   // would match everything if unescaped
    expect(hits.every((r) => r.last_name.includes('%'))).toBe(true);
    expect(hits.length).toBe(1);
  });

  it('treats _ as a literal, not a single-char wildcard', async () => {
    await insertApplication(db, { ...base, lastName: 'a_b', firstName: 'Z' });
    await insertApplication(db, { ...base, lastName: 'axb', firstName: 'Y' });
    const hits = await listApplications(db, 2026, 'all', 'a_b');
    expect(hits.length).toBe(1);
    expect(hits[0].last_name).toBe('a_b');
  });
});
