import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, insertMember, updateMember, softDeleteMember,
  type NewApplication, type MemberEdit,
} from '../src/lib/db';

const app: NewApplication = {
  firstName: 'Fam', lastName: 'Ily', address: '1 St', cityId: 13, phone: '555', email: 'a@b.co',
  diabetic: false, permanentlyDisabled: false, shareWithSponsor: false, fullTimeResidenceConfirmed: true,
  yearsReceivedHelp: 0, adoptedLastYear: false, bedChoice: 'none', bedSize: null, noEmploymentConfirmed: true,
  employers: [],
  benefits: { foodShareAmount: null, socialSecurityAmount: null, socialSecurityFor: '', ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '', unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '' },
  members: [{ name: 'Parent', relationship: 'self', sex: 'F', age: 40, pants: '', shirtTop: '', underwear: '', socks: '', diapers: '', gifts: '' }],
  goodDeed: 'x', seasonYear: 2026, submittedAt: '2026-10-01T00:00:00Z', householdType: 'family',
};
const kid = (name: string): MemberEdit => ({ name, relationship: 'child', sex: 'M', age: 8, pants: '8', shirtTop: 'M', underwear: '8', socks: 'M', diapers: '', gifts: 'lego' });

describe('household member admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('inserts a member at the next position and updates it', async () => {
    const id = await insertApplication(db, app);
    const mid = await insertMember(db, id, kid('Sam'));
    let detail = await getApplicationDetail(db, id);
    expect(detail!.members.map((m) => m.name)).toEqual(['Parent', 'Sam']);
    expect(detail!.members[1].position).toBe(2);
    await updateMember(db, mid, id, { ...kid('Samuel'), age: 9 });
    detail = await getApplicationDetail(db, id);
    expect(detail!.members[1].name).toBe('Samuel');
    expect(detail!.members[1].age).toBe(9);
  });

  it('deletes a member and renumbers remaining positions 1..n', async () => {
    const id = await insertApplication(db, app);          // Parent @ pos 1
    const a = await insertMember(db, id, kid('A'));        // pos 2
    await insertMember(db, id, kid('B'));                  // pos 3
    await softDeleteMember(db, a, id, '2026-11-01T00:00:00Z'); // remove pos 2
    const detail = await getApplicationDetail(db, id);
    expect(detail!.members.map((m) => m.name)).toEqual(['Parent', 'B']);
    expect(detail!.members.map((m) => m.position)).toEqual([1, 2]);
  });

  it('persists the doll choice through insert and update', async () => {
    const id = await insertApplication(db, app);
    const mid = await insertMember(db, id, { ...kid('Sam'), doll: 'black' });
    let row = await db.prepare('SELECT doll FROM household_members WHERE id = ?').bind(mid).first<{ doll: string }>();
    expect(row!.doll).toBe('black');
    await updateMember(db, mid, id, { ...kid('Sam'), doll: 'white' });
    row = await db.prepare('SELECT doll FROM household_members WHERE id = ?').bind(mid).first<{ doll: string }>();
    expect(row!.doll).toBe('white');
  });

  it('does not update or delete a member belonging to a different application', async () => {
    const one = await insertApplication(db, app);
    const two = await insertApplication(db, app);
    const mid = await insertMember(db, one, kid('Keep'));
    await updateMember(db, mid, two, { ...kid('Hacked'), age: 99 }); // wrong app id: no-op
    await softDeleteMember(db, mid, two, '2026-11-01T00:00:00Z');      // wrong app id: no-op
    const detail = await getApplicationDetail(db, one);
    expect(detail!.members.some((m) => m.name === 'Keep')).toBe(true);
    expect(detail!.members.some((m) => m.name === 'Hacked')).toBe(false);
  });
});
