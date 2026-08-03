import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, setApplicationStatus, setStraggler, createPickupDay, softDeletePickupDay,
  setCityPickupDay, setStragglerPickupDay, getSettings, listCities, listApprovedForSlips,
  getApplicationDetail, setPickupDayOverride,
  type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('town pickup-day links', () => {
  it('assigns, resolves on slips, clears, and ignores deleted days', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await createPickupDay(db, { date_text: 'Dec 9', description: 'Lancaster families, 10-2' });
      const day = (await db.prepare("SELECT id FROM pickup_days WHERE date_text = 'Dec 9'").first<{ id: number }>())!.id;

      const fam = await insertApplication(db, base);
      const str = await insertApplication(db, { ...base, lastName: 'Late' });
      await setStraggler(db, str, true);
      await setApplicationStatus(db, fam, 'approved');
      await setApplicationStatus(db, str, 'approved');

      // Unset: no date line for anyone (today's behavior).
      let slips = await listApprovedForSlips(db, 2026);
      expect(slips.every((s) => s.pickup_day === null)).toBe(true);

      // Town day set: the family resolves it; the straggler does NOT.
      await setCityPickupDay(db, 13, day);
      expect((await listCities(db)).find((c) => c.id === 13)?.pickup_day_id).toBe(day);
      slips = await listApprovedForSlips(db, 2026);
      expect(slips.find((s) => s.app.last_name === 'Smith')?.pickup_day?.date_text).toBe('Dec 9');
      expect(slips.find((s) => s.app.last_name === 'Late')?.pickup_day).toBeNull();

      // Straggler day set: the straggler resolves that one.
      await setStragglerPickupDay(db, day);
      expect((await getSettings(db)).straggler_pickup_day_id).toBe(day);
      slips = await listApprovedForSlips(db, 2026);
      expect(slips.find((s) => s.app.last_name === 'Late')?.pickup_day?.description).toContain('Lancaster');

      // Deleted day: resolution vanishes; clearing works.
      await softDeletePickupDay(db, day, '2026-10-02T00:00:00Z');
      slips = await listApprovedForSlips(db, 2026);
      expect(slips.every((s) => s.pickup_day === null)).toBe(true);
      await setCityPickupDay(db, 13, null);
      await setStragglerPickupDay(db, null);
      expect((await getSettings(db)).straggler_pickup_day_id).toBeNull();
    } finally { await dispose(); }
  });

  // Single-slip reprints go through getApplicationDetail, so it must resolve
  // the pickup day by the SAME rule as the bulk slips path — otherwise a lone
  // reprint would print without the date the bulk run shows.
  it('getApplicationDetail resolves the same rule for one application', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await createPickupDay(db, { date_text: 'Dec 9', description: 'Lancaster families, 10-2' });
      const day = (await db.prepare("SELECT id FROM pickup_days WHERE date_text = 'Dec 9'").first<{ id: number }>())!.id;

      const fam = await insertApplication(db, base);
      const str = await insertApplication(db, { ...base, lastName: 'Late' });
      await setStraggler(db, str, true);

      // Unset: no date for anyone.
      expect((await getApplicationDetail(db, fam))?.pickup_day).toBeNull();
      expect((await getApplicationDetail(db, str))?.pickup_day).toBeNull();

      // Town day only: the family resolves it; the straggler never falls back to it.
      await setCityPickupDay(db, 13, day);
      expect((await getApplicationDetail(db, fam))?.pickup_day?.date_text).toBe('Dec 9');
      expect((await getApplicationDetail(db, str))?.pickup_day).toBeNull();

      // Mailed households (elderly/disabled) never pick up: no date on a
      // single-slip reprint even when their town HAS an assigned day.
      const eld = await insertApplication(db, { ...base, lastName: 'Mailed', householdType: 'elderly' });
      expect((await getApplicationDetail(db, eld))?.pickup_day).toBeNull();

      // Straggler day set: the straggler resolves that one.
      await setStragglerPickupDay(db, day);
      expect((await getApplicationDetail(db, str))?.pickup_day?.description).toContain('Lancaster');

      // Deleted day: resolution vanishes for both.
      await softDeletePickupDay(db, day, '2026-10-02T00:00:00Z');
      expect((await getApplicationDetail(db, fam))?.pickup_day).toBeNull();
      expect((await getApplicationDetail(db, str))?.pickup_day).toBeNull();
    } finally { await dispose(); }
  });

  // Big towns (Boscobel, Platteville) pick up across MULTIPLE days (Sherlyn
  // 2026-07-31): a per-family override, set on the application page, beats
  // both the town day and the straggler day; clearing it restores the rule.
  it('a per-family pickup-day override beats the town day and the straggler day', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await createPickupDay(db, { date_text: 'Dec 9', description: 'first day, 10-2' });
      await createPickupDay(db, { date_text: 'Dec 10', description: 'second day, 4-7' });
      await createPickupDay(db, { date_text: 'Dec 20', description: 'straggler day' });
      const id9 = (await db.prepare("SELECT id FROM pickup_days WHERE date_text = 'Dec 9'").first<{ id: number }>())!.id;
      const id10 = (await db.prepare("SELECT id FROM pickup_days WHERE date_text = 'Dec 10'").first<{ id: number }>())!.id;
      const id20 = (await db.prepare("SELECT id FROM pickup_days WHERE date_text = 'Dec 20'").first<{ id: number }>())!.id;

      const fam = await insertApplication(db, base);
      const str = await insertApplication(db, { ...base, lastName: 'Late' });
      await setStraggler(db, str, true);
      await setApplicationStatus(db, fam, 'approved');
      await setApplicationStatus(db, str, 'approved');
      await setCityPickupDay(db, 13, id9);
      await setStragglerPickupDay(db, id20);

      // Baseline: the usual rule.
      expect((await getApplicationDetail(db, fam))?.pickup_day?.date_text).toBe('Dec 9');
      expect((await getApplicationDetail(db, str))?.pickup_day?.date_text).toBe('Dec 20');

      // Override set: it wins for a normal family AND for a straggler.
      await setPickupDayOverride(db, fam, id10);
      await setPickupDayOverride(db, str, id10);
      expect((await getApplicationDetail(db, fam))?.pickup_day?.date_text).toBe('Dec 10');
      expect((await getApplicationDetail(db, str))?.pickup_day?.date_text).toBe('Dec 10');
      const slips = await listApprovedForSlips(db, 2026);
      expect(slips.find((s) => s.app.last_name === 'Smith')?.pickup_day?.date_text).toBe('Dec 10');
      expect(slips.find((s) => s.app.last_name === 'Late')?.pickup_day?.date_text).toBe('Dec 10');

      // Cleared: back to the usual rule.
      await setPickupDayOverride(db, fam, null);
      expect((await getApplicationDetail(db, fam))?.pickup_day?.date_text).toBe('Dec 9');

      // An override pointing at a deleted day resolves to no date, not a crash.
      await softDeletePickupDay(db, id10, '2026-10-02T00:00:00Z');
      expect((await getApplicationDetail(db, str))?.pickup_day).toBeNull();
    } finally { await dispose(); }
  });
});
