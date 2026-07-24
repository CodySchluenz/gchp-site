import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, assignPuNumber, setPuNumber, setStraggler, countBlockUsage,
  softDeleteApplication, listApplications, listApplicationsForExport, listCities,
  setApplicationStatus, listApprovedForSlips, type NewApplication,
} from '../src/lib/db';

const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('block-aware pickup numbers', () => {
  it('first family in a town gets the base, then base+1; idempotent', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'Second' });
      expect(await assignPuNumber(db, a, 2026)).toBe(800);
      expect(await assignPuNumber(db, b, 2026)).toBe(801);
      expect(await assignPuNumber(db, a, 2026)).toBe(800); // idempotent
    } finally { await dispose(); }
  });

  it('elderly and disabled households go to 2500; straggler families to 2400; late elderly stay 2500', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const eld = await insertApplication(db, { ...base, lastName: 'Eld', householdType: 'elderly', members: [{ ...base.members[0], age: 70 }] });
      const dis = await insertApplication(db, { ...base, lastName: 'Dis', householdType: 'disabled', permanentlyDisabled: true });
      const str = await insertApplication(db, { ...base, lastName: 'Str' });
      const lateEld = await insertApplication(db, { ...base, lastName: 'LateEld', householdType: 'elderly' });
      await setStraggler(db, str, true);
      await setStraggler(db, lateEld, true);
      expect(await assignPuNumber(db, eld, 2026)).toBe(2500);
      expect(await assignPuNumber(db, dis, 2026)).toBe(2501);
      expect(await assignPuNumber(db, str, 2026)).toBe(2400);
      expect(await assignPuNumber(db, lateEld, 2026)).toBe(2502);
    } finally { await dispose(); }
  });

  it('soft-deleted numbers still block reuse within the block', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      await assignPuNumber(db, a, 2026); // 800
      await softDeleteApplication(db, a, '2026-10-02T00:00:00Z');
      expect(await assignPuNumber(db, b, 2026)).toBe(801); // never 800 again
    } finally { await dispose(); }
  });

  it('fail-soft: a full block assigns nothing and returns null', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      const r = await setPuNumber(db, a, 2026, 899); // occupy the block's last number
      expect(r.ok).toBe(true);
      expect(await assignPuNumber(db, b, 2026)).toBeNull();
      const rows = await listApplications(db, 2026, 'all', '');
      expect(rows.find((x) => x.last_name === 'B')?.pu_number).toBeNull();
    } finally { await dispose(); }
  });

  it('setPuNumber rejects a duplicate (even a soft-deleted holder) and can clear', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      await setPuNumber(db, a, 2026, 2600); // manual "Kids without toys" number
      await softDeleteApplication(db, a, '2026-10-02T00:00:00Z');
      const dup = await setPuNumber(db, b, 2026, 2600);
      expect(dup.ok).toBe(false);
      if (!dup.ok) expect(dup.takenBy).toBe(a);
      const cleared = await setPuNumber(db, b, 2026, null);
      expect(cleared.ok).toBe(true);
    } finally { await dispose(); }
  });

  it('countBlockUsage counts numbers in the block', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      await assignPuNumber(db, a, 2026);
      await assignPuNumber(db, b, 2026);
      expect(await countBlockUsage(db, 2026, 800)).toBe(2);
      expect(await countBlockUsage(db, 2026, 1500)).toBe(0);
    } finally { await dispose(); }
  });

  it('town and mailed filters, and filtered views order by number', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const a = await insertApplication(db, base);
      const b = await insertApplication(db, { ...base, lastName: 'B' });
      const eld = await insertApplication(db, { ...base, lastName: 'Eld', householdType: 'elderly' });
      await assignPuNumber(db, b, 2026);   // 800 (assigned first)
      await assignPuNumber(db, a, 2026);   // 801
      await assignPuNumber(db, eld, 2026); // 2500
      const town = await listApplications(db, 2026, 'all', '', 13);
      expect(town.map((r) => r.last_name)).toEqual(['B', 'Smith', 'Eld']); // geography incl. mailed; number order
      const mailed = await listApplications(db, 2026, 'all', '', 'mailed');
      expect(mailed.map((r) => r.last_name)).toEqual(['Eld']);
      expect(mailed[0].address).toBe('1 Elm'); // mail list carries the address
      const exportTown = await listApplicationsForExport(db, 2026, 'all', '', 13);
      expect(exportTown).toHaveLength(3);
      const exportMailed = await listApplicationsForExport(db, 2026, 'all', '', 'mailed');
      expect(exportMailed).toHaveLength(1);
    } finally { await dispose(); }
  });

  it('pickup slips exclude mailed households', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const fam = await insertApplication(db, base);
      const eld = await insertApplication(db, { ...base, lastName: 'Eld', householdType: 'elderly' });
      await assignPuNumber(db, fam, 2026); await setApplicationStatus(db, fam, 'approved');
      await assignPuNumber(db, eld, 2026); await setApplicationStatus(db, eld, 'approved');
      const slips = await listApprovedForSlips(db, 2026);
      expect(slips.map((s) => s.app.last_name)).toEqual(['Smith']);
    } finally { await dispose(); }
  });

  it('stragglers filter is flag-based (not the 2400s number range), ordered by number, and flows to export', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const strA = await insertApplication(db, base);                       // straggler, assigned into the 2400s
      const strB = await insertApplication(db, { ...base, lastName: 'B' }); // straggler, but a hand-typed number outside 2400s
      const notStr = await insertApplication(db, { ...base, lastName: 'NotStr' }); // NOT a straggler, but hand-typed into the 2400s
      await setStraggler(db, strA, true);
      await setStraggler(db, strB, true);
      await assignPuNumber(db, strA, 2026);      // 2400
      await setPuNumber(db, strB, 2026, 999);    // outside the 2400s — still a straggler by flag
      await setPuNumber(db, notStr, 2026, 2405); // inside the 2400s — but the flag says no
      const rows = await listApplications(db, 2026, 'all', '', 'stragglers');
      expect(rows.map((r) => r.last_name)).toEqual(['B', 'Smith']); // pu_number order: 999, then 2400
      const exportRows = await listApplicationsForExport(db, 2026, 'all', '', 'stragglers');
      expect(exportRows.map((r) => r.last_name)).toEqual(['B', 'Smith']);
    } finally { await dispose(); }
  });

  it('listCities returns block_base', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const cities = await listCities(db);
      expect(cities.find((c) => c.id === 13)?.block_base).toBe(800);
    } finally { await dispose(); }
  });
});
