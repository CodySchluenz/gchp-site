import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, assignPuNumber, setApplicationStatus,
  softDeleteApplication, restoreApplication, getApplicationDetail, listApplications, setPackingNote, type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('admin actions', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('assigns sequential PU numbers per season and is idempotent', async () => {
    const a = await insertApplication(db, base);
    const b = await insertApplication(db, base);
    expect(await assignPuNumber(db, a, 2026)).toBe(800);
    expect(await assignPuNumber(db, b, 2026)).toBe(801);
    expect(await assignPuNumber(db, a, 2026)).toBe(800); // idempotent
    const other = await insertApplication(db, { ...base, seasonYear: 2025, submittedAt: '2025-10-01T00:00:00Z' });
    expect(await assignPuNumber(db, other, 2025)).toBe(800); // per-season sequence
  });

  it('sets status', async () => {
    const id = await insertApplication(db, base);
    await setApplicationStatus(db, id, 'approved');
    const d = await getApplicationDetail(db, id);
    expect(d!.app.status).toBe('approved');
  });

  it('soft-deletes and restores', async () => {
    const id = await insertApplication(db, base);
    await softDeleteApplication(db, id, '2026-10-05T00:00:00Z');
    expect(await getApplicationDetail(db, id)).toBeNull();
    expect((await listApplications(db, 2026, 'all', '')).some((r) => r.id === id)).toBe(false);
    await restoreApplication(db, id);
    expect(await getApplicationDetail(db, id)).not.toBeNull();
  });

  it('saves and caps the packing note at 1000 characters', async () => {
    const id = await insertApplication(db, base);
    await setPackingNote(db, id, 'Ring doorbell twice, dog is friendly.');
    let d = await getApplicationDetail(db, id);
    expect(d!.app.packing_note).toBe('Ring doorbell twice, dog is friendly.');

    await setPackingNote(db, id, 'x'.repeat(1001));
    d = await getApplicationDetail(db, id);
    expect((d!.app.packing_note as string).length).toBe(1000);
  });
});
