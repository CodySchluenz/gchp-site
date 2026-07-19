import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { listCities, insertApplication, type NewApplication } from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm St', cityId: 13,
  phone: '608-555-0100', email: 'sue@example.com',
  diabetic: true, permanentlyDisabled: false, shareWithSponsor: true,
  fullTimeResidenceConfirmed: true, yearsReceivedHelp: 2, adoptedLastYear: false,
  bedChoice: 'blanket', bedSize: 'queen',
  noEmploymentConfirmed: false,
  employers: [{ employerName: 'Acme', workerName: 'Sue Smith', hourlyWage: 15.5, hoursPerWeek: 32 }],
  benefits: {
    foodShareAmount: 250,
    socialSecurityAmount: null, socialSecurityFor: '',
    ssiAmount: 450, ssiFor: 'Sue',
    childSupportAmount: null, childSupportFor: '',
    unemploymentWeeklyAmount: null, unemploymentFor: '',
    otherIncomeAmount: null, otherIncomeFor: '',
  },
  members: [
    { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 34, pants: '', shirtTop: 'M', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '8', shirtTop: '8', underwear: '8', socks: '3', diapers: '', gifts: 'legos' },
  ],
  goodDeed: 'I shoveled snow.',
  seasonYear: 2026, submittedAt: '2026-10-02T15:00:00.000Z',
  mayNotBeEligible: false, householdType: 'family',
};

describe('application db helpers', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it('listCities returns the seeded city', async () => {
    expect(await listCities(db)).toEqual([{ id: 13, name: 'Lancaster', block_base: 800, pickup_day_id: null }]);
  });

  it('insertApplication writes the application, members, and employers', async () => {
    const id = await insertApplication(db, app);
    expect(id).toBeGreaterThan(0);

    const row = await db.prepare('SELECT * FROM applications WHERE id = ?').bind(id).first<any>();
    expect(row.first_name).toBe('Sue');
    expect(row.status).toBe('new');
    expect(row.season_year).toBe(2026);
    expect(row.diabetic).toBe(1);
    expect(row.bed_size).toBe('queen');
    expect(row.ssi_amount).toBe(450);
    expect(row.ssi_for).toBe('Sue');
    expect(row.social_security_amount).toBeNull();
    expect(row.may_not_be_eligible).toBe(0);
    expect(row.household_type).toBe('family');
    expect(row.pu_number).toBeNull();

    const members = await db
      .prepare('SELECT * FROM household_members WHERE application_id = ? ORDER BY position')
      .bind(id).all<any>();
    expect(members.results).toHaveLength(2);
    expect(members.results[0]).toMatchObject({ position: 1, name: 'Sue Smith', relationship: 'self' });
    expect(members.results[1]).toMatchObject({ position: 2, age: 7, gifts: 'legos' });

    const employers = await db
      .prepare('SELECT * FROM employers WHERE application_id = ?').bind(id).all<any>();
    expect(employers.results).toHaveLength(1);
    expect(employers.results[0]).toMatchObject({ employer_name: 'Acme', hourly_wage: 15.5 });
  });

  it('stores bed_size as NULL when the choice is none', async () => {
    const id = await insertApplication(db, { ...app, bedChoice: 'none', bedSize: null });
    const row = await db.prepare('SELECT bed_choice, bed_size FROM applications WHERE id = ?').bind(id).first<any>();
    expect(row).toEqual({ bed_choice: 'none', bed_size: null });
  });

  it('deletes the orphaned application row when the child batch fails', async () => {
    const failingDb = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'batch') {
          return () => Promise.reject(new Error('simulated batch failure'));
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    }) as D1Database;
    const before = await db.prepare('SELECT COUNT(*) AS n FROM applications').first<{ n: number }>();
    await expect(insertApplication(failingDb, app)).rejects.toThrow('simulated batch failure');
    const after = await db.prepare('SELECT COUNT(*) AS n FROM applications').first<{ n: number }>();
    expect(after?.n).toBe(before?.n);
  });
});
