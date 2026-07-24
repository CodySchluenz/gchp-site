import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, setCardsGiven, thanksgivingCount, softDeleteApplication, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('cards given + thanksgiving count', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('round-trips the five fields', async () => {
    const id = await insertApplication(db, base);
    await setCardsGiven(db, id, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: false, giftCardAmount: null });
    const row = await db.prepare('SELECT thanksgiving_card, food_card, food_card_amount, gift_card, gift_card_amount FROM applications WHERE id = ?').bind(id).first<Record<string, unknown>>();
    expect(row).toEqual({ thanksgiving_card: 1, food_card: 1, food_card_amount: 50, gift_card: 0, gift_card_amount: null });
  });

  it('counts thanksgiving cards per season, ignoring deleted', async () => {
    // Season 2027 here (not 2026) because this file's beforeAll shares one DB
    // across both `it`s, and the prior test already planted a
    // thanksgivingCard:true row in season 2026 — counting 2026 here would
    // double-count that unrelated row. Same convention as db-pu.test.ts /
    // db-latest-season.test.ts: pick a season untouched by other tests.
    const a = await insertApplication(db, { ...base, seasonYear: 2027 });
    const b = await insertApplication(db, { ...base, seasonYear: 2027 });
    const other = await insertApplication(db, { ...base, seasonYear: 2025 });
    for (const id of [a, b, other]) await setCardsGiven(db, id, { thanksgivingCard: true, foodCard: false, foodCardAmount: null, giftCard: false, giftCardAmount: null });
    expect(await thanksgivingCount(db, 2027)).toBe(2);
    await softDeleteApplication(db, b, '2026-10-02T00:00:00Z');
    expect(await thanksgivingCount(db, 2027)).toBe(1);
  });
});
