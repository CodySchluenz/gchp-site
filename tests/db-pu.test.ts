import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, assignPuNumber, type NewApplication } from '../src/lib/db';

const app: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('assignPuNumber', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('hands out increasing numbers per season and is idempotent', async () => {
    const one = await insertApplication(db, app);
    const two = await insertApplication(db, app);
    expect(await assignPuNumber(db, one, 2026)).toBe(1);
    expect(await assignPuNumber(db, two, 2026)).toBe(2);
    expect(await assignPuNumber(db, one, 2026)).toBe(1); // idempotent
  });

  it('numbers restart from 1 in a different season', async () => {
    const older = await insertApplication(db, { ...app, seasonYear: 2025 });
    expect(await assignPuNumber(db, older, 2025)).toBe(1);
  });
});
