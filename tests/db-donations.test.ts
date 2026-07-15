import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  createDonor, listDonationsForDonor, createDonation, softDeleteDonation, restoreDonation,
  donationSummaryForYear, listDonationYears, softDeleteDonor, type DonorEdit,
} from '../src/lib/db';

const blank: DonorEdit = { name: '', contact_person: '', address: '', city: '', state: '', zip: '', phone: '', email: '' };

describe('donation admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates donations under a donor and lists only that donor newest-first', async () => {
    const a = await createDonor(db, { ...blank, name: 'A' });
    const b = await createDonor(db, { ...blank, name: 'B' });
    await createDonation(db, a, { date: '2026-11-01', amount: 100, itemDescription: 'cash' });
    await createDonation(db, a, { date: '2026-11-05', amount: null, itemDescription: 'toys' });
    await createDonation(db, b, { date: '2026-11-03', amount: 50, itemDescription: '' });
    const forA = await listDonationsForDonor(db, a);
    expect(forA.map((d) => d.date)).toEqual(['2026-11-05', '2026-11-01']); // newest first
    expect(forA.every((d) => d.donor_id === a)).toBe(true);
  });

  it('soft-delete and restore are scoped by donor_id', async () => {
    const a = await createDonor(db, { ...blank, name: 'A2' });
    const b = await createDonor(db, { ...blank, name: 'B2' });
    const did = await createDonation(db, a, { date: '2026-11-01', amount: 10, itemDescription: '' });
    await softDeleteDonation(db, did, b, '2026-11-02T00:00:00Z'); // wrong donor: no-op
    expect((await listDonationsForDonor(db, a)).length).toBe(1);
    await softDeleteDonation(db, did, a, '2026-11-02T00:00:00Z'); // right donor
    expect((await listDonationsForDonor(db, a)).length).toBe(0);
    await restoreDonation(db, did, b); // wrong donor: no-op
    expect((await listDonationsForDonor(db, a)).length).toBe(0);
    await restoreDonation(db, did, a); // right donor
    expect((await listDonationsForDonor(db, a)).length).toBe(1);
  });

  it('summarizes a calendar year: count all, sum non-null amounts, ignore other years/deleted', async () => {
    const { db: db2, dispose: d2 } = await getTestDb();
    try {
      const a = await createDonor(db2, { ...blank, name: 'Sum' });
      await createDonation(db2, a, { date: '2026-01-15', amount: 200, itemDescription: '' });
      await createDonation(db2, a, { date: '2026-12-31', amount: null, itemDescription: 'toys' }); // counts, adds 0
      await createDonation(db2, a, { date: '2025-06-01', amount: 999, itemDescription: '' });       // other year
      const gone = await createDonation(db2, a, { date: '2026-02-02', amount: 500, itemDescription: '' });
      await softDeleteDonation(db2, gone, a, '2026-03-01T00:00:00Z');                                // excluded
      const b = await createDonor(db2, { ...blank, name: 'DeletedDonor' });
      await createDonation(db2, b, { date: '2026-05-05', amount: 300, itemDescription: '' });
      await softDeleteDonor(db2, b, '2026-06-01T00:00:00Z');
      const s = await donationSummaryForYear(db2, '2026');
      expect(s).toEqual({ count: 2, total: 200 });
    } finally { await d2(); }
  });

  it('lists distinct donation years newest-first, excluding deleted donations and donors', async () => {
    const { db: db3, dispose: d3 } = await getTestDb();
    try {
      const a = await createDonor(db3, { ...blank, name: 'Years' });
      await createDonation(db3, a, { date: '2026-03-01', amount: 10, itemDescription: '' });
      await createDonation(db3, a, { date: '2025-11-01', amount: 20, itemDescription: '' });
      await createDonation(db3, a, { date: '2026-07-01', amount: 30, itemDescription: '' }); // same year, dedup
      const del = await createDonation(db3, a, { date: '2024-01-01', amount: 5, itemDescription: '' });
      await softDeleteDonation(db3, del, a, '2024-02-01T00:00:00Z'); // deleted -> its year excluded
      expect(await listDonationYears(db3)).toEqual(['2026', '2025']);
    } finally { await d3(); }
  });
});
