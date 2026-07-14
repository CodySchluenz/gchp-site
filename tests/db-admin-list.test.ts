import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, listApplications, listSeasons, type NewApplication } from '../src/lib/db';

function makeApp(over: Partial<NewApplication>): NewApplication {
  return {
    firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13,
    phone: '608', email: 'a@b.co', diabetic: false, permanentlyDisabled: false,
    shareWithSponsor: false, fullTimeResidenceConfirmed: true, yearsReceivedHelp: 0,
    adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
    employers: [],
    benefits: {
      foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '',
      ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '',
      unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '',
    },
    members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
    goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00.000Z',
    mayNotBeEligible: false, householdType: 'family',
    ...over,
  };
}

describe('listApplications / listSeasons', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
    await insertApplication(db, makeApp({ firstName: 'Anna', lastName: 'Adams', submittedAt: '2026-10-01T00:00:00Z' }));
    await insertApplication(db, makeApp({ firstName: 'Bob', lastName: 'Baker', submittedAt: '2026-10-03T00:00:00Z' }));
    const denied = await insertApplication(db, makeApp({ firstName: 'Cy', lastName: 'Carter', submittedAt: '2026-10-02T00:00:00Z' }));
    await db.prepare("UPDATE applications SET status='denied' WHERE id=?").bind(denied).run();
    await insertApplication(db, makeApp({ firstName: 'Old', lastName: 'Timer', seasonYear: 2025, submittedAt: '2025-10-01T00:00:00Z' }));
    const gone = await insertApplication(db, makeApp({ firstName: 'Del', lastName: 'Eted' }));
    await db.prepare("UPDATE applications SET deleted_at='2026-10-05T00:00:00Z' WHERE id=?").bind(gone).run();
  });
  afterAll(async () => { await dispose(); });

  it('lists the current season newest-first, excludes soft-deleted and other seasons', async () => {
    const rows = await listApplications(db, 2026, 'all', '');
    expect(rows.map((r) => r.first_name)).toEqual(['Bob', 'Cy', 'Anna']); // newest submitted first
    expect(rows.every((r) => r.city_name === 'Lancaster')).toBe(true);
  });

  it('filters by status', async () => {
    expect((await listApplications(db, 2026, 'denied', '')).map((r) => r.first_name)).toEqual(['Cy']);
    expect((await listApplications(db, 2026, 'new', '')).map((r) => r.first_name)).toEqual(['Bob', 'Anna']);
  });

  it('searches by name case-insensitively across first and last', async () => {
    expect((await listApplications(db, 2026, 'all', 'baker')).map((r) => r.first_name)).toEqual(['Bob']);
    expect((await listApplications(db, 2026, 'all', 'ANNA')).map((r) => r.first_name)).toEqual(['Anna']);
  });

  it('lists distinct seasons descending, ignoring deleted-only rows', async () => {
    expect(await listSeasons(db)).toEqual([2026, 2025]);
  });
});
