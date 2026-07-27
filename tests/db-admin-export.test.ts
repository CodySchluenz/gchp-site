import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { insertApplication, setApplicationStatus, setApplicationNotes, setCardsGiven, setAdoption, listApplicationsForExport, type NewApplication } from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [
    { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
    { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
  ],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('listApplicationsForExport binds both branches', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it("runs the 'all' branch and summarizes members", async () => {
    await insertApplication(db, base);
    const rows = await listApplicationsForExport(db, 2026, 'all', '');
    expect(rows).toHaveLength(1);
    expect(rows[0].city_name).toBe('Lancaster');
    expect(rows[0].member_summary).toContain('Sue Smith (self, age 40)');
    expect(rows[0].member_summary).toContain('Tim Smith (son, age 7)');
  });

  it("runs a specific-status branch (binds ?1 and ?2)", async () => {
    const id = await insertApplication(db, { ...base, firstName: 'Approved' });
    await setApplicationStatus(db, id, 'approved');
    const approved = await listApplicationsForExport(db, 2026, 'approved', '');
    expect(approved.every((r) => r.status === 'approved')).toBe(true);
    expect(approved.some((r) => r.first_name === 'Approved')).toBe(true);
    expect(approved.find((r) => r.first_name === 'Approved')?.decided_at).toBeTruthy();
  });

  it('includes the new columns and per-application aggregates', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, {
        ...base, firstName: 'Ex', lastName: 'Port', yearsReceivedHelp: 2, adoptedLastYear: true,
        bedChoice: 'blanket', bedSize: 'full',
        benefits: { ...base.benefits, ssiAmount: 520, ssiFor: 'self', childSupportAmount: 200, childSupportFor: 'kids' },
        members: [
          { name: 'P', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'K', relationship: 'child', sex: 'M', age: 8, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
        ],
        employers: [{ employerName: 'Acme', workerName: 'P', hourlyWage: 15, hoursPerWeek: 40 }],
      });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      const r = rows.find((x) => x.last_name === 'Port')!;
      expect(r.member_count).toBe(2);
      expect(r.years_received_help).toBe(2);
      expect(r.adopted_last_year).toBe(1);
      expect(r.bed_choice).toBe('blanket');
      expect(r.ssi_amount).toBe(520);
      expect(r.employment_summary).toContain('Acme');
      expect(id).toBeGreaterThan(0);
    } finally { await dispose(); }
  });

  it('honors the name filter (with LIKE escaping)', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await insertApplication(db, { ...base, lastName: 'Findme' });
      await insertApplication(db, { ...base, lastName: 'Other' });
      const rows = await listApplicationsForExport(db, 2026, 'all', 'findme');
      expect(rows.length).toBe(1);
      expect(rows[0].last_name).toBe('Findme');
    } finally { await dispose(); }
  });

  it('summarizes every relationship CASE arm and carries parentage/admin notes', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, {
        ...base, firstName: 'Notes', lastName: 'Coverage',
        parentageNote: 'Dad has the kids Mon-Wed.',
        members: [
          { name: 'Parent A', relationship: 'other_parent', sex: 'F', age: 35, disabled: true, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'Court B', relationship: 'court', sex: 'M', age: 10, partTime: true, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'NotRel C', relationship: 'not_related', sex: 'M', age: 30, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'Friend D', relationship: 'other', relationshipOther: 'family friend', sex: 'F', age: 45, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
        ],
      });
      await setApplicationNotes(db, id, 'Verified income 2026-10-02.');

      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      const r = rows.find((x) => x.last_name === 'Coverage')!;

      expect(r.member_summary).toContain('parent');
      expect(r.member_summary).toContain('court-appointed');
      expect(r.member_summary).toContain('not related');
      expect(r.member_summary).toContain('family friend');
      expect(r.member_summary).toContain(', disabled');
      expect(r.member_summary).toContain(', part-time');
      expect(r.parentage_note).toBe('Dad has the kids Mon-Wed.');
      expect(r.admin_notes).toBe('Verified income 2026-10-02.');
    } finally { await dispose(); }
  });

  it('summarizes gift requests per person', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await insertApplication(db, {
        ...base, lastName: 'Gifty',
        members: [
          { name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'Tim Smith', relationship: 'son', sex: 'M', age: 7, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'bike' },
          { name: 'Ann Smith', relationship: 'daughter', sex: 'F', age: 5, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'books' },
        ],
      });
      await insertApplication(db, { ...base, lastName: 'NoGifts' });
      const rows = await listApplicationsForExport(db, 2026, 'all', '');
      expect(rows.find((r) => r.last_name === 'Gifty')?.gifts_summary).toBe('Tim Smith: bike; Ann Smith: books');
      expect(rows.find((r) => r.last_name === 'NoGifts')?.gifts_summary).toBe('');
    } finally { await dispose(); }
  });

  it('exports dolls and card-tracking fields', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, {
        ...base, lastName: 'Dolls',
        members: [
          { name: 'Mom Dolls', relationship: 'self', sex: 'F', age: 30, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' },
          { name: 'Sue Dolls', relationship: 'daughter', sex: 'F', age: 5, doll: 'non_white', pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'blocks' },
        ],
      });
      await setCardsGiven(db, id, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: true, giftCardAmount: 25 });
      const r = (await listApplicationsForExport(db, 2026, 'all', '')).find((x) => x.last_name === 'Dolls')!;
      expect(r.dolls_summary).toBe('Non-White doll (Sue Dolls)');
      expect(r.member_summary).toContain('non-white doll');
      expect(r.thanksgiving_card).toBe(1);
      expect(r.food_card_amount).toBe(50);
      expect(r.gift_card_amount).toBe(25);
    } finally { await dispose(); }
  });

  it('exports the adoption columns, defaulted until marked', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, { ...base, lastName: 'Adopted' });
      const before = (await listApplicationsForExport(db, 2026, 'all', '')).find((r) => r.last_name === 'Adopted')!;
      expect(before.adopted).toBe(0);
      expect(before.adopter_name).toBe('');
      expect(before.adopter_contact).toBe('');
      expect(before.adopter_phone).toBe('');
      expect(before.adopter_address).toBe('');

      await setAdoption(db, id, {
        adopterName: 'Platteville Kiwanis', adopterContact: 'Jo Doe',
        adopterPhone: '608-555-0100', adopterAddress: '1 Main St',
      });
      const after = (await listApplicationsForExport(db, 2026, 'all', '')).find((r) => r.last_name === 'Adopted')!;
      expect(after.adopted).toBe(1);
      expect(after.adopter_name).toBe('Platteville Kiwanis');
      expect(after.adopter_contact).toBe('Jo Doe');
      expect(after.adopter_phone).toBe('608-555-0100');
      expect(after.adopter_address).toBe('1 Main St');
    } finally { await dispose(); }
  });
});
