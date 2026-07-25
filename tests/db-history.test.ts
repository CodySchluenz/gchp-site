import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  addHistory, historyStatements, listHistory, insertApplication, softDeleteApplication, restoreApplication,
  getApplicationDetail, updateMember, type NewApplication, type MemberEdit,
} from '../src/lib/db';
import { describeMemberChange } from '../src/lib/history';

const base: NewApplication = {
  firstName: 'A', lastName: 'A', address: '1', cityId: 13, phone: '6', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [], benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'A', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};

describe('application history rows', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('adds and lists newest-first', async () => {
    const id = await insertApplication(db, base);
    await addHistory(db, id, 'a@b.co', 'bags', 'Bag count set to 4', '2026-10-02T00:00:00Z');
    await db.batch(historyStatements(db, id, 'a@b.co', 'application', ['Address changed from 1 Elm to 2 Oak', 'Phone changed from blank to 608'], '2026-10-03T00:00:00Z'));
    const rows = await listHistory(db, id);
    // newest first; the received row from insertApplication is last
    expect(rows[0].summary).toBe('Phone changed from blank to 608');
    expect(rows.at(-1)!.summary).toBe('Application received online');
    expect(rows.at(-1)!.actor_email).toBe('');
    expect(rows.at(-1)!.area).toBe('record');
    expect(rows.at(-1)!.at).toBe(base.submittedAt);
  });

  it('stamps the as-submitted snapshot and the paper actor', async () => {
    const id = await insertApplication(db, { ...base, source: 'paper' }, 'admin@x.co');
    const row = await db.prepare('SELECT original_json FROM applications WHERE id = ?').bind(id).first<{ original_json: string }>();
    const snap = JSON.parse(row!.original_json);
    expect(snap.firstName).toBe(base.firstName);
    expect(snap.members.length).toBe(base.members.length);
    const rows = await listHistory(db, id);
    expect(rows.at(-1)!.summary).toBe('Entered from a paper application');
    expect(rows.at(-1)!.actor_email).toBe('admin@x.co');
  });

  it('a save flow writes composed rows that list back newest-first', async () => {
    const id = await insertApplication(db, base);
    const lines = ['Approved; pickup number 803 assigned', 'Bag count set to 4'];
    await db.batch(historyStatements(db, id, 'admin@x.co', 'decision', [lines[0]], '2026-11-01T00:00:00Z'));
    await addHistory(db, id, 'admin@x.co', 'bags', lines[1], '2026-11-02T00:00:00Z');
    const rows = await listHistory(db, id);
    expect(rows.map((r) => r.summary).slice(0, 2)).toEqual([lines[1], lines[0]]);
    // History must survive the application's soft-delete and restore untouched.
    await softDeleteApplication(db, id, '2026-11-03T00:00:00Z');
    await restoreApplication(db, id);
    expect((await listHistory(db, id)).length).toBe(rows.length);
  });

  it('a member edit composes a diff from the pre-update row and writes it under area "people"', async () => {
    const id = await insertApplication(db, base);
    const detail = await getApplicationDetail(db, id);
    const current = detail!.members.find((x) => Number(x.id) === Number(detail!.members[0].id))!;
    const edit: MemberEdit = {
      name: 'A', relationship: 'self', relationshipOther: '', sex: 'F', age: 41,
      disabled: false, partTime: false, doll: '',
      pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', shoe: '', coat: '', gifts: '',
    };
    const lines = describeMemberChange('updated', current, edit);
    await updateMember(db, Number(current.id), id, edit);
    await db.batch(historyStatements(db, id, 'admin@x.co', 'people', lines, '2026-11-04T00:00:00Z'));
    const rows = await listHistory(db, id);
    expect(rows[0].summary).toBe('A: age changed from 40 to 41');
    expect(rows[0].area).toBe('people');
  });

  it('a failed "received" history write must never fail a saved application', async () => {
    const { db, dispose } = await getTestDb();
    try {
      await db.prepare('DROP TABLE application_history').run();
      const id = await insertApplication(db, base);
      expect(id).toBeGreaterThan(0);
      const row = await db.prepare('SELECT COUNT(*) AS n FROM applications WHERE id = ?').bind(id).first<{ n: number }>();
      expect(row?.n).toBe(1);
    } finally { await dispose(); }
  });
});
