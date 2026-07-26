import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, setApplicationStatus, setStraggler, setCardsGiven, softDeleteMember,
  softDeleteApplication, assignPuNumber, getSeasonSummary, listPossibleDuplicates,
  type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('getSeasonSummary', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
    // A second town (Cuba City, id 7) so the "towns omits zero-count cities"
    // case has a real city with a non-qualifying application to omit, not
    // just an absent one. Not seeded by getTestDb — migrations/0002_seed.sql
    // (the real seed) is deliberately not part of the test harness.
    await db.prepare("INSERT INTO cities (id, name, zip, block_base) VALUES (7, 'Cuba City', '53807', 300)").run();
  });
  afterAll(async () => { await dispose(); });

  // Distinct seasons per `it` (house convention — see tests/db-cards-given.test.ts)
  // since this describe shares one db across every case below.

  it('counts + sources: received/online/paper/imported and status buckets', async () => {
    const season = 2030;
    const approvedOnline = await insertApplication(db, { ...base, seasonYear: season, lastName: 'ApprovedOnline' });
    await setApplicationStatus(db, approvedOnline, 'approved');

    const newOnline = await insertApplication(db, { ...base, seasonYear: season, lastName: 'NewOnline' });
    void newOnline; // left as 'new' — the default status

    const deniedPaper = await insertApplication(db, { ...base, seasonYear: season, lastName: 'DeniedPaper', source: 'paper' });
    await setApplicationStatus(db, deniedPaper, 'denied');

    // Simulates a legacy imported row: inserted normally (source defaults to
    // 'online'), then blanked via raw SQL — the one exception the brief for
    // this task allows, since insertApplication has no 'imported' source.
    const deniedImported = await insertApplication(db, { ...base, seasonYear: season, lastName: 'DeniedImported' });
    await db.prepare("UPDATE applications SET source = '' WHERE id = ?").bind(deniedImported).run();
    await setApplicationStatus(db, deniedImported, 'denied');

    const summary = await getSeasonSummary(db, season);
    expect(summary.received).toBe(4);
    expect(summary.online).toBe(2);
    expect(summary.paper).toBe(1);
    expect(summary.imported).toBe(1);
    expect(summary.served).toBe(1);
    expect(summary.toReview).toBe(1);
    expect(summary.denied).toBe(2);
  });

  it('peopleServed counts members of approved applications only, excluding soft-deleted members', async () => {
    const season = 2031;
    const approvedId = await insertApplication(db, {
      ...base, seasonYear: season, lastName: 'Approved',
      members: [
        { name: 'Approved Adult', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
        { name: 'Approved Child', relationship: 'daughter', sex: 'F', age: 8, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
      ],
    });
    await setApplicationStatus(db, approvedId, 'approved');

    // A still-new (not approved) application with its own member — must never count.
    await insertApplication(db, {
      ...base, seasonYear: season, lastName: 'StillNew',
      members: [{ name: 'New Adult', relationship: 'self', sex: 'M', age: 30, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
    });

    expect((await getSeasonSummary(db, season)).peopleServed).toBe(2);

    const members = await db
      .prepare('SELECT id FROM household_members WHERE application_id = ? ORDER BY position')
      .bind(approvedId)
      .all<{ id: number }>();
    await softDeleteMember(db, members.results[1].id, approvedId, '2026-10-02T00:00:00Z');

    expect((await getSeasonSummary(db, season)).peopleServed).toBe(1);
  });

  it('town precedence: a mailed+straggler household counts as mailed only; towns omit non-qualifying cities; served = townsSum + stragglers + mailed', async () => {
    const season = 2032;

    const family = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Family', cityId: 13 });
    await setApplicationStatus(db, family, 'approved');

    const stragglerFamily = await insertApplication(db, { ...base, seasonYear: season, lastName: 'StragglerFamily', cityId: 13 });
    await setApplicationStatus(db, stragglerFamily, 'approved');
    await setStraggler(db, stragglerFamily, true);

    // Elderly AND straggler: must land in `mailed`, not `stragglers`, and must
    // not appear in `towns` (towns excludes elderly/disabled households).
    const mailedStraggler = await insertApplication(db, {
      ...base, seasonYear: season, lastName: 'MailedStraggler', cityId: 13, householdType: 'elderly',
      members: [{ name: 'Elder', relationship: 'self', sex: 'F', age: 70, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
    });
    await setApplicationStatus(db, mailedStraggler, 'approved');
    await setStraggler(db, mailedStraggler, true);

    // A second town's application that is NOT approved — proves that city's
    // absence from `towns` is a true omission (the city has an application
    // row this season), not just an empty table.
    const deniedOtherTown = await insertApplication(db, { ...base, seasonYear: season, lastName: 'DeniedOtherTown', cityId: 7 });
    await setApplicationStatus(db, deniedOtherTown, 'denied');

    const summary = await getSeasonSummary(db, season);
    expect(summary.towns).toEqual([{ name: 'Lancaster', count: 1 }]);
    expect(summary.stragglers).toBe(1);
    expect(summary.mailed).toBe(1);
    const townsSum = summary.towns.reduce((sum, t) => sum + t.count, 0);
    expect(summary.served).toBe(townsSum + summary.stragglers + summary.mailed);
    expect(summary.served).toBe(3);
  });

  it('cards: thanksgiving/food/gift counted across statuses, null amounts treated as zero', async () => {
    const season = 2033;

    const approved = await insertApplication(db, { ...base, seasonYear: season, lastName: 'CardApproved' });
    await setApplicationStatus(db, approved, 'approved');
    await setCardsGiven(db, approved, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: true, giftCardAmount: 25 });

    const denied = await insertApplication(db, { ...base, seasonYear: season, lastName: 'CardDenied' });
    await setApplicationStatus(db, denied, 'denied');
    await setCardsGiven(db, denied, { thanksgivingCard: true, foodCard: false, foodCardAmount: null, giftCard: true, giftCardAmount: null });

    const summary = await getSeasonSummary(db, season);
    expect(summary.thanksgiving).toBe(2);
    expect(summary.foodCards).toBe(1);
    expect(summary.foodCardTotal).toBe(50);
    expect(summary.giftCards).toBe(2);
    expect(summary.giftCardTotal).toBe(25);
  });

  it('season scoping + soft-delete: another season and a soft-deleted application count nowhere', async () => {
    const season = 2034;
    const otherSeason = 2035;

    const keep = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Keep' });
    await setApplicationStatus(db, keep, 'approved');
    await setCardsGiven(db, keep, { thanksgivingCard: true, foodCard: true, foodCardAmount: 10, giftCard: false, giftCardAmount: null });

    const deleted = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Deleted' });
    await setApplicationStatus(db, deleted, 'approved');
    await setCardsGiven(db, deleted, { thanksgivingCard: true, foodCard: true, foodCardAmount: 999, giftCard: true, giftCardAmount: 999 });
    await softDeleteApplication(db, deleted, '2026-10-02T00:00:00Z');

    const otherSeasonApp = await insertApplication(db, { ...base, seasonYear: otherSeason, lastName: 'OtherSeason' });
    await setApplicationStatus(db, otherSeasonApp, 'approved');
    await setCardsGiven(db, otherSeasonApp, { thanksgivingCard: true, foodCard: true, foodCardAmount: 999, giftCard: true, giftCardAmount: 999 });

    const summary = await getSeasonSummary(db, season);
    expect(summary.received).toBe(1);
    expect(summary.served).toBe(1);
    expect(summary.peopleServed).toBe(1);
    expect(summary.towns).toEqual([{ name: 'Lancaster', count: 1 }]);
    expect(summary.stragglers).toBe(0);
    expect(summary.mailed).toBe(0);
    expect(summary.thanksgiving).toBe(1);
    expect(summary.foodCards).toBe(1);
    expect(summary.foodCardTotal).toBe(10);
    expect(summary.giftCards).toBe(0);
    expect(summary.giftCardTotal).toBe(0);
  });
});

describe('listPossibleDuplicates', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it("matches within the same season on last name + address, returning the OTHER row's fields, including pu_number after approval", async () => {
    const season = 2050;
    const a = await insertApplication(db, { ...base, seasonYear: season, firstName: 'Alice', lastName: 'Smith', address: '123 Oak St' });
    const b = await insertApplication(db, { ...base, seasonYear: season, firstName: 'Bob', lastName: 'Smith', address: '123 Oak St' });
    await setApplicationStatus(db, b, 'approved');
    const puNumber = await assignPuNumber(db, b, season);

    const results = await listPossibleDuplicates(db, a);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: b, first_name: 'Bob', last_name: 'Smith', address: '123 Oak St',
      status: 'approved', pu_number: puNumber, source: 'online',
    });
  });

  it('matches case and whitespace variants of the same name + address', async () => {
    const season = 2051;
    const a = await insertApplication(db, { ...base, seasonYear: season, lastName: ' SMITH ', address: ' 123  Oak   St ' });
    const b = await insertApplication(db, { ...base, seasonYear: season, lastName: 'smith', address: '123 oak st' });

    expect((await listPossibleDuplicates(db, a)).map((r) => r.id)).toEqual([b]);
  });

  it('never matches across different seasons', async () => {
    const a = await insertApplication(db, { ...base, seasonYear: 2052, lastName: 'Jones', address: '5 Elm' });
    await insertApplication(db, { ...base, seasonYear: 2053, lastName: 'Jones', address: '5 Elm' });

    expect(await listPossibleDuplicates(db, a)).toEqual([]);
  });

  it('never matches on a blank address, even with the same last name', async () => {
    const season = 2054;
    const a = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Anderson', address: '' });
    await insertApplication(db, { ...base, seasonYear: season, lastName: 'Anderson', address: '' });

    expect(await listPossibleDuplicates(db, a)).toEqual([]);
  });

  it('excludes the application itself from its own matches', async () => {
    const season = 2055;
    const a = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Miller', address: '9 Pine' });
    const b = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Miller', address: '9 Pine' });
    const c = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Miller', address: '9 Pine' });

    const ids = (await listPossibleDuplicates(db, a)).map((r) => r.id).sort();
    expect(ids).toEqual([b, c].sort());
  });

  it('excludes a soft-deleted candidate', async () => {
    const season = 2056;
    const a = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Baker', address: '7 Pine' });
    const b = await insertApplication(db, { ...base, seasonYear: season, lastName: 'Baker', address: '7 Pine' });
    await softDeleteApplication(db, b, '2026-10-02T00:00:00Z');

    expect(await listPossibleDuplicates(db, a)).toEqual([]);
  });
});
