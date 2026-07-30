import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, insertMember, softDeleteMember, listApplications, listSeasons, type NewApplication } from '../src/lib/db';

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
    householdType: 'family',
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

// The grandfather finder (spec §"The grandfather finder"): a quiet flag on
// family-typed rows only, so she can spot a family household that might
// really be an elderly/disabled one and split it by hand.
describe('has_elderly_member flag', () => {
  const oldster = { name: 'Grandma Elder', relationship: 'other', sex: 'F', age: 65, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' };

  it('flags a family household with a 65-year-old member', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Fam', lastName: 'Elder' }));
      await insertMember(db, id, oldster);
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_elderly_member).toBe(1);
    } finally { await dispose(); }
  });

  it('does not flag a family household whose oldest member is 64', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Fam', lastName: 'Young' }));
      await insertMember(db, id, { ...oldster, name: 'Not Quite', age: 64 });
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_elderly_member).toBe(0);
    } finally { await dispose(); }
  });

  it('does not flag when the only 65+ member was soft-deleted', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Fam', lastName: 'Removed' }));
      const memberId = await insertMember(db, id, oldster);
      await softDeleteMember(db, memberId, id, '2026-11-01T00:00:00Z');
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_elderly_member).toBe(0);
    } finally { await dispose(); }
  });

  it('does not flag a non-family (elderly-typed) household even with a 70-year-old member', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Eld', lastName: 'Erly', householdType: 'elderly' }));
      await insertMember(db, id, { ...oldster, name: 'Grandpa Erly', age: 70 });
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_elderly_member).toBe(0);
    } finally { await dispose(); }
  });
});

// The disabled finder (Sherlyn 2026-07-30, sibling of the grandfather finder):
// a family household containing a permanently disabled member gets a quiet
// flag so she can split the person onto their own card application by hand —
// while a disabled parent with children under 18 stays a family household.
describe('has_disabled_member flag', () => {
  const disabledAdult = { name: 'Uncle Dee', relationship: 'other', sex: 'M', age: 45, disabled: true, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' };

  it('flags a family household with a disabled member', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Fam', lastName: 'Dis' }));
      await insertMember(db, id, disabledAdult);
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_disabled_member).toBe(1);
    } finally { await dispose(); }
  });

  it('does not flag when no member is disabled', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Fam', lastName: 'Abled' }));
      await insertMember(db, id, { ...disabledAdult, name: 'Well Adult', disabled: false });
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_disabled_member).toBe(0);
    } finally { await dispose(); }
  });

  it('does not flag when the only disabled member was soft-deleted', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Fam', lastName: 'DisGone' }));
      const memberId = await insertMember(db, id, disabledAdult);
      await softDeleteMember(db, memberId, id, '2026-11-01T00:00:00Z');
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_disabled_member).toBe(0);
    } finally { await dispose(); }
  });

  it('does not flag a disabled-typed household (they already have their program)', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, makeApp({ firstName: 'Dis', lastName: 'Abled', householdType: 'disabled' }));
      await insertMember(db, id, disabledAdult);
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((r) => r.id === id)!.has_disabled_member).toBe(0);
    } finally { await dispose(); }
  });
});
