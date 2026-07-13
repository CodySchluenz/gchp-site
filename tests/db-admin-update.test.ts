import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, updateApplicationCore, getApplicationDetail, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('updateApplicationCore', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('updates editable core fields, leaving members untouched', async () => {
    const id = await insertApplication(db, base);
    await updateApplicationCore(db, id, {
      firstName: 'Susan', lastName: 'Smith', address: '2 Oak St', cityId: 13, phone: '608-555',
      email: 'susan@example.com', diabetic: true, shareWithSponsor: true, permanentlyDisabled: false,
      bedChoice: 'blanket', bedSize: 'queen', yearsReceivedHelp: 3, adoptedLastYear: true, householdType: 'elderly',
    });
    const d = await getApplicationDetail(db, id);
    expect(d!.app.first_name).toBe('Susan');
    expect(d!.app.address).toBe('2 Oak St');
    expect(d!.app.diabetic).toBe(1);
    expect(d!.app.bed_size).toBe('queen');
    expect(d!.app.household_type).toBe('elderly');
    expect(d!.members).toHaveLength(1); // untouched
  });
});
