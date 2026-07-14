import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, getApplicationDetail, type NewApplication } from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: true, permanentlyDisabled: false, shareWithSponsor: true, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 2, adoptedLastYear: false, bedChoice: 'blanket', bedSize: 'queen',
  noEmploymentConfirmed: false,
  employers: [{ employerName: 'Acme', workerName: 'Sue', hourlyWage: 15.5, hoursPerWeek: 32 }],
  benefits: { foodShareAmount: 250, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [
    { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 34, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '8', shirtTop: '8', underwear: '', socks: '', diapers: '', gifts: 'legos' },
  ],
  goodDeed: 'shoveled snow', seasonYear: 2026, submittedAt: '2026-10-02T00:00:00Z',
  mayNotBeEligible: false, householdType: 'family',
};

describe('getApplicationDetail', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('returns the full application with city, members, employers', async () => {
    const id = await insertApplication(db, app);
    const d = await getApplicationDetail(db, id);
    expect(d).not.toBeNull();
    expect(d!.city_name).toBe('Lancaster');
    expect(d!.app.first_name).toBe('Sue');
    expect(d!.app.food_share_amount).toBe(250);
    expect(d!.members.map((m) => m.name)).toEqual(['Sue Smith', 'Tim Smith']);
    expect(d!.employers).toHaveLength(1);
    expect(d!.employers[0].employer_name).toBe('Acme');
  });

  it('returns null for a missing or soft-deleted application', async () => {
    expect(await getApplicationDetail(db, 999999)).toBeNull();
    const id = await insertApplication(db, app);
    await db.prepare("UPDATE applications SET deleted_at='2026-10-06T00:00:00Z' WHERE id=?").bind(id).run();
    expect(await getApplicationDetail(db, id)).toBeNull();
  });
});
