import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import {
  insertApplication, getApplicationDetail, insertEmployer, updateEmployer, softDeleteEmployer,
  type NewApplication, type EmployerEdit,
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
const job = (name: string): EmployerEdit => ({ employerName: name, workerName: 'Parent', hourlyWage: 15, hoursPerWeek: 40 });

describe('employer admin helpers', () => {
  let db: D1Database; let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('inserts, updates, and deletes an employer', async () => {
    const id = await insertApplication(db, app);
    const eid = await insertEmployer(db, id, job('Acme'));
    let detail = await getApplicationDetail(db, id);
    expect(detail!.employers.map((e) => e.employer_name)).toEqual(['Acme']);
    await updateEmployer(db, eid, id, { ...job('Acme'), hourlyWage: 18.5, hoursPerWeek: 32 });
    detail = await getApplicationDetail(db, id);
    expect(detail!.employers[0].hourly_wage).toBe(18.5);
    expect(detail!.employers[0].hours_per_week).toBe(32);
    await softDeleteEmployer(db, eid, id, '2026-11-01T00:00:00Z');
    detail = await getApplicationDetail(db, id);
    expect(detail!.employers.length).toBe(0);
  });

  it('does not touch an employer belonging to a different application', async () => {
    const one = await insertApplication(db, app);
    const two = await insertApplication(db, app);
    const eid = await insertEmployer(db, one, job('Keep'));
    await updateEmployer(db, eid, two, { ...job('Hacked'), hourlyWage: 1, hoursPerWeek: 1 });
    await softDeleteEmployer(db, eid, two, '2026-11-01T00:00:00Z');
    const detail = await getApplicationDetail(db, one);
    expect(detail!.employers.map((e) => e.employer_name)).toEqual(['Keep']);
  });
});
