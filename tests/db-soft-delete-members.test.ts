import { describe, it, expect } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, insertMember, insertEmployer,
  softDeleteMember, restoreMember, softDeleteEmployer, restoreEmployer,
  listApplicationsForExport, listApprovedForSlips,
  setApplicationStatus, assignPuNumber,
  listContactMessages, unreadMessageCount, softDeleteContactMessage, restoreContactMessage,
  type NewApplication,
} from '../src/lib/db';

// Fixture copied from tests/db-source.test.ts's `base`.
const base: NewApplication = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '608', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

const kid = { name: 'Kid Smith', relationship: 'son', sex: 'M', age: 8, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: 'bike' };
const job = { employerName: 'Acme', workerName: 'Sue', hourlyWage: 15, hoursPerWeek: 40 };

describe('soft-deleted household members', () => {
  it('a soft-deleted member disappears from getApplicationDetail, slips, and export member_summary/gifts_summary', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, base); // Sue Smith @ position 1
      const kidId = await insertMember(db, id, kid); // Kid Smith @ position 2
      await setApplicationStatus(db, id, 'approved');
      await assignPuNumber(db, id, 2026);

      await softDeleteMember(db, kidId, id, '2026-11-01T00:00:00Z');

      const detail = await getApplicationDetail(db, id);
      expect(detail!.members.map((m) => m.name)).toEqual(['Sue Smith']);

      const exportRows = await listApplicationsForExport(db, 2026, 'all', '');
      const exp = exportRows.find((r) => r.last_name === 'Smith')!;
      expect(exp.member_count).toBe(1);
      expect(exp.member_summary).not.toContain('Kid Smith');
      expect(exp.gifts_summary).not.toContain('bike');

      const slips = await listApprovedForSlips(db, 2026);
      const slip = slips.find((s) => s.app.id === id)!;
      expect(slip.members.map((m) => m.name)).toEqual(['Sue Smith']);
    } finally { await dispose(); }
  });

  it('restore brings a soft-deleted member back everywhere', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, base);
      const kidId = await insertMember(db, id, kid);
      await softDeleteMember(db, kidId, id, '2026-11-01T00:00:00Z');
      expect((await getApplicationDetail(db, id))!.members.map((m) => m.name)).toEqual(['Sue Smith']);

      await restoreMember(db, kidId, id);

      const detail = await getApplicationDetail(db, id);
      expect(detail!.members.map((m) => m.name).sort()).toEqual(['Kid Smith', 'Sue Smith']);

      const exportRows = await listApplicationsForExport(db, 2026, 'all', '');
      const exp = exportRows.find((r) => r.last_name === 'Smith')!;
      expect(exp.member_count).toBe(2);
      expect(exp.member_summary).toContain('Kid Smith');
      expect(exp.gifts_summary).toContain('bike');
    } finally { await dispose(); }
  });

  it('restoreMember is scoped by application_id and cannot restore into the wrong application', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const one = await insertApplication(db, base);
      const two = await insertApplication(db, base);
      const kidId = await insertMember(db, one, kid);
      await softDeleteMember(db, kidId, one, '2026-11-01T00:00:00Z');
      await restoreMember(db, kidId, two); // wrong app id: no-op
      expect((await getApplicationDetail(db, one))!.members.map((m) => m.name)).toEqual(['Sue Smith']);
    } finally { await dispose(); }
  });
});

describe('soft-deleted employers', () => {
  it('a soft-deleted employer disappears from getApplicationDetail and export employment_summary', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, base);
      const eid = await insertEmployer(db, id, job);

      await softDeleteEmployer(db, eid, id, '2026-11-01T00:00:00Z');

      const detail = await getApplicationDetail(db, id);
      expect(detail!.employers).toHaveLength(0);

      const exportRows = await listApplicationsForExport(db, 2026, 'all', '');
      const exp = exportRows.find((r) => r.last_name === 'Smith')!;
      expect(exp.employment_summary).toBe('');
    } finally { await dispose(); }
  });

  it('restore brings a soft-deleted employer back everywhere', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await insertApplication(db, base);
      const eid = await insertEmployer(db, id, job);
      await softDeleteEmployer(db, eid, id, '2026-11-01T00:00:00Z');

      await restoreEmployer(db, eid, id);

      const detail = await getApplicationDetail(db, id);
      expect(detail!.employers).toHaveLength(1);

      const exportRows = await listApplicationsForExport(db, 2026, 'all', '');
      const exp = exportRows.find((r) => r.last_name === 'Smith')!;
      expect(exp.employment_summary).toContain('Acme');
    } finally { await dispose(); }
  });
});

describe('soft-deleted contact messages', () => {
  async function seedMessage(db: D1Database, name: string): Promise<number> {
    await db
      .prepare('INSERT INTO contact_messages (received_at, name, email, message) VALUES (?, ?, ?, ?)')
      .bind('2026-11-01T00:00:00Z', name, `${name}@x.co`, 'hi')
      .run();
    const row = await db.prepare('SELECT id FROM contact_messages WHERE name = ?').bind(name).first<{ id: number }>();
    return row!.id;
  }

  it('a soft-deleted message disappears from the list and the unread count', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await seedMessage(db, 'Ann');
      expect(await unreadMessageCount(db)).toBe(1);

      await softDeleteContactMessage(db, id, '2026-11-02T00:00:00Z');

      const list = await listContactMessages(db);
      expect(list.find((m) => m.name === 'Ann')).toBeUndefined();
      expect(await unreadMessageCount(db)).toBe(0);
    } finally { await dispose(); }
  });

  // Restore of a hard-deleted row is impossible, so before this feature
  // existed this assertion could never pass — natural RED.
  it('restore brings a soft-deleted message back to the list and the unread count', async () => {
    const { db, dispose } = await getTestDb();
    try {
      const id = await seedMessage(db, 'Ben');
      await softDeleteContactMessage(db, id, '2026-11-02T00:00:00Z');
      expect(await unreadMessageCount(db)).toBe(0);

      await restoreContactMessage(db, id);

      const list = await listContactMessages(db);
      expect(list.find((m) => m.name === 'Ben')).toBeTruthy();
      expect(await unreadMessageCount(db)).toBe(1);
    } finally { await dispose(); }
  });
});
