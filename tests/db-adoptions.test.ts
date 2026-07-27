import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, setApplicationStatus, setAdoption, clearAdoption, listAdoptions,
  listApplications, listApprovedForSlips, softDeleteApplication,
  type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: true, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('setAdoption / clearAdoption', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('setAdoption marks adopted=1 and stores the four fields', async () => {
    const season = 2040;
    const id = await insertApplication(db, { ...base, seasonYear: season });
    await setAdoption(db, id, {
      adopterName: 'Platteville Kiwanis', adopterContact: 'Jo Doe',
      adopterPhone: '608-555-0100', adopterAddress: '1 Main St',
    });
    const row = await db
      .prepare('SELECT adopted, adopter_name, adopter_contact, adopter_phone, adopter_address FROM applications WHERE id = ?')
      .bind(id).first<Record<string, unknown>>();
    expect(row).toEqual({
      adopted: 1, adopter_name: 'Platteville Kiwanis', adopter_contact: 'Jo Doe',
      adopter_phone: '608-555-0100', adopter_address: '1 Main St',
    });
  });

  it('clearAdoption sets adopted=0 but KEEPS the adopter fields (re-marking convenience)', async () => {
    const season = 2041;
    const id = await insertApplication(db, { ...base, seasonYear: season });
    await setAdoption(db, id, {
      adopterName: 'Smith Family', adopterContact: 'Pat Smith',
      adopterPhone: '608-555-0101', adopterAddress: '2 Oak St',
    });
    await clearAdoption(db, id);
    const row = await db
      .prepare('SELECT adopted, adopter_name, adopter_contact, adopter_phone, adopter_address FROM applications WHERE id = ?')
      .bind(id).first<Record<string, unknown>>();
    expect(row).toEqual({
      adopted: 0, adopter_name: 'Smith Family', adopter_contact: 'Pat Smith',
      adopter_phone: '608-555-0101', adopter_address: '2 Oak St',
    });
  });
});

describe('listAdoptions', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('lists only adopted=1, non-deleted, ordered by adopter_name then id, scoped to the season', async () => {
    const season = 2042;
    const zeta = await insertApplication(db, { ...base, seasonYear: season, firstName: 'Zeta' });
    await setAdoption(db, zeta, { adopterName: 'Zeta Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });

    const alphaFirst = await insertApplication(db, { ...base, seasonYear: season, firstName: 'AlphaFirst' });
    await setAdoption(db, alphaFirst, { adopterName: 'Alpha Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });
    const alphaSecond = await insertApplication(db, { ...base, seasonYear: season, firstName: 'AlphaSecond' });
    await setAdoption(db, alphaSecond, { adopterName: 'Alpha Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });

    // Not adopted: must be excluded.
    await insertApplication(db, { ...base, seasonYear: season, firstName: 'NotAdopted' });

    // Adopted but a different season: must be excluded.
    const otherSeasonId = await insertApplication(db, { ...base, seasonYear: 2043, firstName: 'OtherSeason' });
    await setAdoption(db, otherSeasonId, { adopterName: 'Other Season Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });

    // Adopted but soft-deleted: must be excluded.
    const deletedId = await insertApplication(db, { ...base, seasonYear: season, firstName: 'Deleted' });
    await setAdoption(db, deletedId, { adopterName: 'AAA Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });
    await softDeleteApplication(db, deletedId, '2026-10-02T00:00:00Z');

    const rows = await listAdoptions(db, season);
    expect(rows.map((r) => r.first_name)).toEqual(['AlphaFirst', 'AlphaSecond', 'Zeta']); // by adopter_name, then id
    expect(rows.every((r) => r.city_name === 'Lancaster')).toBe(true);
  });
});

describe('adopted families leave the packing flow', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('an approved family disappears from listApprovedForSlips once adopted', async () => {
    const season = 2044;
    const id = await insertApplication(db, { ...base, seasonYear: season, firstName: 'Adoptee' });
    await setApplicationStatus(db, id, 'approved');

    const before = await listApprovedForSlips(db, season);
    expect(before.some((s) => s.app.first_name === 'Adoptee')).toBe(true);

    await setAdoption(db, id, { adopterName: 'Some Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });

    const after = await listApprovedForSlips(db, season);
    expect(after.some((s) => s.app.first_name === 'Adoptee')).toBe(false);
  });
});

describe('listApplications carries the adopted tag', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('rows report adopted=0 by default and adopted=1 once marked', async () => {
    const season = 2045;
    const id = await insertApplication(db, { ...base, seasonYear: season, firstName: 'Tagged' });
    const before = (await listApplications(db, season, 'all', '')).find((r) => r.first_name === 'Tagged');
    expect(before?.adopted).toBe(0);

    await setAdoption(db, id, { adopterName: 'Tag Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });
    const after = (await listApplications(db, season, 'all', '')).find((r) => r.first_name === 'Tagged');
    expect(after?.adopted).toBe(1);
  });
});
