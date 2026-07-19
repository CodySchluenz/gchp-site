import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, setApplicationStatus, setStraggler, createPickupDay, softDeletePickupDay,
  setCityPickupDay, setStragglerPickupDay, getSettings, listCities, listApprovedForSlips,
  type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', mayNotBeEligible: false, householdType: 'family',
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
});
