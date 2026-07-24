import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, setApplicationNotes, updateApplicationFull,
  type NewApplication, type ApplicationFullEdit,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [
    { name: 'Sue', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Jim', relationship: 'not_related', relationshipOther: '', sex: 'M', age: 38, disabled: true, partTime: false, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', shoe: '11', coat: 'XL', gifts: '' },
  ],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
  parentageNote: 'Jim is nobody\'s parent.',
};

describe('application relationships persistence', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('round-trips new member fields and the parentage note', async () => {
    const id = await insertApplication(db, base);
    const detail = await getApplicationDetail(db, id);
    expect(detail!.app.parentage_note).toBe('Jim is nobody\'s parent.');
    const jim = detail!.members[1];
    expect(jim.relationship).toBe('not_related');
    expect(jim.disabled).toBe(1);
    expect(jim.shoe).toBe('11');
    expect(jim.coat).toBe('XL');
  });

  it('saves admin notes and an edited parentage note', async () => {
    const id = await insertApplication(db, base);
    await setApplicationNotes(db, id, 'Boyfriend excluded; gave gift card.');
    const edit: ApplicationFullEdit = {
      firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
      diabetic: false, shareWithSponsor: false, permanentlyDisabled: false, bedChoice: 'none', bedSize: null,
      yearsReceivedHelp: 0, adoptedLastYear: false, householdType: 'family', fullTimeResidenceConfirmed: true,
      noEmploymentConfirmed: true, foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '',
      ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null,
      unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '', goodDeed: 'x',
      parentageNote: 'Edited note.',
    };
    await updateApplicationFull(db, id, edit);
    const detail = await getApplicationDetail(db, id);
    expect(detail!.app.admin_notes).toBe('Boyfriend excluded; gave gift card.');
    expect(detail!.app.parentage_note).toBe('Edited note.');
  });
});
