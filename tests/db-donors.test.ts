import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { listDonors, getDonor, createDonor, updateDonor, softDeleteDonor, restoreDonor, type DonorEdit } from '../src/lib/db';

const blank: DonorEdit = { name: '', contact_person: '', address: '', city: '', state: '', zip: '', phone: '', email: '' };
const donor = (name: string, over: Partial<DonorEdit> = {}): DonorEdit => ({ ...blank, name, ...over });

describe('donor admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('creates, lists (ordered by name), and gets a donor', async () => {
    const b = await createDonor(db, donor('Beta Co', { city: 'Platteville', phone: '555' }));
    await createDonor(db, donor('Alpha Inc'));
    const all = await listDonors(db, '');
    expect(all.map((d) => d.name)).toEqual(['Alpha Inc', 'Beta Co']);
    const got = await getDonor(db, b);
    expect([got!.name, got!.city, got!.phone]).toEqual(['Beta Co', 'Platteville', '555']);
  });

  it('search matches by name and treats % literally', async () => {
    const { db: db2, dispose: d2 } = await getTestDb();
    try {
      await createDonor(db2, donor('Acme'));
      await createDonor(db2, donor('50% Off Store'));
      expect((await listDonors(db2, 'acme')).map((d) => d.name)).toEqual(['Acme']);
      expect((await listDonors(db2, '%')).map((d) => d.name)).toEqual(['50% Off Store']);
    } finally { await d2(); }
  });

  it('updates a donor', async () => {
    const id = await createDonor(db, donor('Gamma'));
    await updateDonor(db, id, donor('Gamma LLC', { email: 'g@x.co' }));
    const got = await getDonor(db, id);
    expect([got!.name, got!.email]).toEqual(['Gamma LLC', 'g@x.co']);
  });

  it('soft-deletes (hidden from list and get) and restores', async () => {
    const id = await createDonor(db, donor('Temp'));
    await softDeleteDonor(db, id, '2026-11-01T00:00:00Z');
    expect((await listDonors(db, '')).some((d) => d.id === id)).toBe(false);
    expect(await getDonor(db, id)).toBe(null);
    await restoreDonor(db, id);
    expect(await getDonor(db, id)).not.toBe(null);
  });
});
