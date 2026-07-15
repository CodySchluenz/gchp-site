import { describe, it, expect } from 'vitest';
import { transformApplicants } from './transform-applicants.mjs';

const base = {
  applicants: [
    { appID: 10, fName: 'Sue', lName: "O'Neil", address: '1 Elm', cityID: 13, tree: 1, diabetic: 0, phone: '555', email: 's@x.co', date: '2025/8/15', approved: '1', reviewed: '1', bedType: 'blanket', bedSize: 'queen' },
    { appID: 11, fName: 'Ann', lName: 'Roe', address: '2 Oak', cityID: 13, tree: 0, diabetic: 1, phone: '556', email: 'a@x.co', date: '2025/10/1', approved: '0', reviewed: '0', bedType: 'sheet', bedSize: '' },
  ],
  appEmp: [
    { appID: 10, employer1: 'Acme', wage1: 15, hrsPerWk1: 40, employer2: 'Bee', wage2: 12.5, hrsPerWk2: 10, employer3: '', wage3: null, hrsPerWk3: null, employer4: '', wage4: null, hrsPerWk4: null },
  ],
  benefits: [
    { appID: 10, fsAmount: 200, ssiAmount: null, w2Amount: 500, csAmount: 120, omAmount: 30, socAmount: null },
  ],
  children: [
    { childID: 5, appID: 10, name: 'Kid B', sex: 'M', age: 8, pantSize: '8', shirtSize: 'M', undSize: '8', sockSize: 'M', diaperSize: '', gift: 'lego' },
    { childID: 4, appID: 10, name: 'Kid A', sex: 'F', age: 10, pantSize: '10', shirtSize: 'L', undSize: '10', sockSize: 'L', diaperSize: '', gift: 'books' },
  ],
  goodDeed: [{ appID: 10, deedText: 'Helped a neighbor' }],
};

describe('transformApplicants', () => {
  it('maps an approved applicant with benefits, employers, children, and good deed', () => {
    const { applications, members, employers, flagged } = transformApplicants(base);
    const a = applications.find((x) => x.id === 10);
    expect(a.first_name).toBe('Sue');
    expect(a.last_name).toBe("O'Neil");
    expect(a.city_id).toBe(13);
    expect(a.share_with_sponsor).toBe(1);       // from tree
    expect(a.status).toBe('approved');          // approved '1'
    expect(a.submitted_at).toBe('2025-08-15T00:00:00Z');
    expect(a.season_year).toBe(2025);
    expect(a.bed_choice).toBe('blanket');
    expect(a.bed_size).toBe('queen');
    expect(a.food_share_amount).toBe(200);
    expect(a.other_income_amount).toBe(530);    // omAmount 30 + w2Amount 500
    expect(a.other_income_for).toBe('includes migrated W-2 wages');
    expect(a.no_employment_confirmed).toBe(0);  // has employers
    expect(a.household_type).toBe('family');
    expect(a.good_deed).toBe('Helped a neighbor');
    expect(flagged).toContainEqual({ type: 'w2-fold', appID: 10 });

    const kids = members.filter((m) => m.application_id === 10);
    expect(kids.map((m) => m.name)).toEqual(['Kid A', 'Kid B']); // ordered by childID
    expect(kids.map((m) => m.position)).toEqual([1, 2]);
    expect(kids[0].relationship).toBe('');

    const emps = employers.filter((e) => e.application_id === 10);
    expect(emps.length).toBe(2);                // blank slots 3/4 skipped
    expect(emps[0]).toEqual({ application_id: 10, employer_name: 'Acme', worker_name: 'Sue O\'Neil', hourly_wage: 15, hours_per_week: 40 });
  });

  it('handles a not-approved, childless, employer-less applicant with a sheet bed', () => {
    const { applications, members, employers, flagged } = transformApplicants(base);
    const a = applications.find((x) => x.id === 11);
    expect(a.status).toBe('new');
    expect(a.diabetic).toBe(1);
    expect(a.share_with_sponsor).toBe(0);
    expect(a.bed_choice).toBe('sheets');        // 'sheet' -> 'sheets'
    expect(a.bed_size).toBe(null);              // blank size
    expect(a.no_employment_confirmed).toBe(1);  // no employer row
    expect(a.other_income_amount).toBe(null);   // no benefits row

    const mem = members.filter((m) => m.application_id === 11);
    expect(mem.length).toBe(1);                 // synthesized head member
    expect(mem[0]).toEqual({ application_id: 11, position: 1, name: 'Ann Roe', relationship: 'self', sex: '', age: 0, pants: '', shirt_top: '', underwear: '', socks: '', diapers: '', gifts: '' });
    expect(flagged).toContainEqual({ type: 'synth-member', appID: 11 });
    expect(employers.filter((e) => e.application_id === 11).length).toBe(0);
  });

  it('falls back for an unparseable date', () => {
    const { applications } = transformApplicants({ ...base, applicants: [{ ...base.applicants[0], appID: 12, date: 'garbage' }], children: [], appEmp: [], benefits: [], goodDeed: [] });
    const a = applications.find((x) => x.id === 12);
    expect(a.submitted_at).toBe('2025-01-01T00:00:00Z');
    expect(a.season_year).toBe(2025);
  });
});
