import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, updateApplicationFull,
  type NewApplication, type ApplicationFullEdit,
} from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Old', lastName: 'Name', address: '1 St', cityId: 13, phone: '555', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: false,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Parent', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'first', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
};

describe('updateApplicationFull', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('round-trips every editable field including null amounts', async () => {
    const id = await insertApplication(db, app);
    const edit: ApplicationFullEdit = {
      firstName: 'New', lastName: 'Name2', address: '2 Ave', cityId: 13, phone: '999', email: 'c@d.co',
      diabetic: true, shareWithSponsor: true, permanentlyDisabled: true,
      bedChoice: 'blanket', bedSize: 'queen', yearsReceivedHelp: 3, adoptedLastYear: true, householdType: 'elderly',
      fullTimeResidenceConfirmed: true, noEmploymentConfirmed: false,
      foodShareAmount: 250, socialSecurityAmount: 800, socialSecurityFor: 'self',
      ssiAmount: null, ssiFor: '', childSupportAmount: 120.5, childSupportFor: 'kids',
      unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '',
      goodDeed: 'second', mayNotBeEligible: true,
    };
    await updateApplicationFull(db, id, edit);
    const a = (await getApplicationDetail(db, id))!.app;
    expect(a.first_name).toBe('New');
    expect(a.diabetic).toBe(1);
    expect(a.bed_choice).toBe('blanket');
    expect(a.bed_size).toBe('queen');
    expect(a.food_share_amount).toBe(250);
    expect(a.child_support_amount).toBe(120.5);
    expect(a.ssi_amount).toBe(null);
    expect(a.good_deed).toBe('second');
    expect(a.may_not_be_eligible).toBe(1);
    expect(a.household_type).toBe('elderly');
  });
});
