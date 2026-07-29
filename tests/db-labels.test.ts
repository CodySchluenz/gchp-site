import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, setApplicationStatus, setAdoption, softDeleteApplication,
  listMailedForLabels, type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: true, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 70, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'elderly',
};

describe('listMailedForLabels', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
    // A second city so ordering-by-city can be observed (harness only seeds Lancaster).
    await db.prepare("INSERT INTO cities (id, name, zip, block_base) VALUES (7, 'Cuba City', '53807', 300)").run();
  });
  afterAll(async () => { await dispose(); });

  it('includes only approved, elderly/disabled, non-adopted, non-deleted households in the season', async () => {
    const season = 2050;

    const approvedElderly = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Approved', lastName: 'Elderly', householdType: 'elderly',
    });
    await setApplicationStatus(db, approvedElderly, 'approved');

    const approvedDisabled = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Approved', lastName: 'Disabled', householdType: 'disabled',
    });
    await setApplicationStatus(db, approvedDisabled, 'approved');

    // Denied: must be excluded even though it's elderly.
    const denied = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Denied', lastName: 'Elderly', householdType: 'elderly',
    });
    await setApplicationStatus(db, denied, 'denied');

    // New (never decided): must be excluded — not approved.
    await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Pending', lastName: 'Elderly', householdType: 'elderly',
    });

    // Family household, approved: must be excluded — not elderly/disabled.
    const family = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Approved', lastName: 'Family', householdType: 'family',
    });
    await setApplicationStatus(db, family, 'approved');

    // Approved elderly but adopted out: must be excluded.
    const adopted = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Approved', lastName: 'Adopted', householdType: 'elderly',
    });
    await setApplicationStatus(db, adopted, 'approved');
    await setAdoption(db, adopted, { adopterName: 'Org', adopterContact: '', adopterPhone: '', adopterAddress: '' });

    // Approved elderly, different season: must be excluded.
    const otherSeason = await insertApplication(db, {
      ...base, seasonYear: season + 1, firstName: 'Approved', lastName: 'OtherSeason', householdType: 'elderly',
    });
    await setApplicationStatus(db, otherSeason, 'approved');

    // Approved elderly, soft-deleted: must be excluded.
    const deleted = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Approved', lastName: 'Deleted', householdType: 'disabled',
    });
    await setApplicationStatus(db, deleted, 'approved');
    await softDeleteApplication(db, deleted, '2026-10-02T00:00:00Z');

    const rows = await listMailedForLabels(db, season);
    // Same city (Lancaster) for both survivors, so alphabetical by last name: Disabled before Elderly.
    expect(rows.map((r) => `${r.first_name} ${r.last_name}`)).toEqual(['Approved Disabled', 'Approved Elderly']);
    expect(rows[1]).toEqual({ first_name: 'Approved', last_name: 'Elderly', address: '1', city_name: 'Lancaster' });
  });

  it('orders by city name, then last name', async () => {
    const season = 2060;
    const zCity = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'Z', lastName: 'Zed', cityId: 13, householdType: 'elderly',
    });
    await setApplicationStatus(db, zCity, 'approved');
    const aCityB = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'B', lastName: 'Beta', cityId: 7, householdType: 'elderly',
    });
    await setApplicationStatus(db, aCityB, 'approved');
    const aCityA = await insertApplication(db, {
      ...base, seasonYear: season, firstName: 'A', lastName: 'Alpha', cityId: 7, householdType: 'disabled',
    });
    await setApplicationStatus(db, aCityA, 'approved');

    const rows = await listMailedForLabels(db, season);
    expect(rows.map((r) => `${r.city_name}/${r.last_name}`)).toEqual([
      'Cuba City/Alpha', 'Cuba City/Beta', 'Lancaster/Zed',
    ]);
  });
});
