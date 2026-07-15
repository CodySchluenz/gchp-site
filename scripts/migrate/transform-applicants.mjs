const str = (v) => (v == null ? '' : String(v).trim());
const numOrNull = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const bool01 = (v) => (String(v).trim() === '1' ? 1 : 0);

// Old date is text 'YYYY/M/D'. Returns { iso, year } or null.
function parseOldDate(v) {
  const m = String(v ?? '').trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`;
  return { iso, year: Number(y) };
}

function indexByApp(rows) {
  const map = {};
  for (const r of rows) map[Number(r.appID)] = r; // one row per applicant
  return map;
}
function groupByApp(rows) {
  const map = {};
  for (const r of rows) (map[Number(r.appID)] ||= []).push(r);
  return map;
}

export function transformApplicants({ applicants, appEmp, benefits, children, goodDeed }) {
  const empByApp = indexByApp(appEmp || []);
  const benByApp = indexByApp(benefits || []);
  const deedByApp = indexByApp(goodDeed || []);
  const kidsByApp = groupByApp(children || []);

  const applications = [];
  const members = [];
  const employers = [];
  const flagged = [];

  for (const a of applicants || []) {
    const appID = Number(a.appID);
    const fullName = `${str(a.fName)} ${str(a.lName)}`.trim();

    // Date
    const d = parseOldDate(a.date);
    const submitted_at = d ? d.iso : '2025-01-01T00:00:00Z';
    const season_year = d ? d.year : 2025;

    // Bed
    const bedType = str(a.bedType).toLowerCase();
    const bed_choice = bedType === 'sheet' ? 'sheets' : bedType === 'blanket' ? 'blanket' : 'none';
    const rawSize = str(a.bedSize).toLowerCase();
    const bed_size = bed_choice !== 'none' && ['twin', 'full', 'queen', 'king'].includes(rawSize) ? rawSize : null;

    // Employers (up to 4 inline slots)
    const e = empByApp[appID];
    let hasEmployer = false;
    if (e) {
      for (let k = 1; k <= 4; k++) {
        const name = str(e['employer' + k]);
        if (name !== '') {
          hasEmployer = true;
          employers.push({
            application_id: appID,
            employer_name: name,
            worker_name: fullName,
            hourly_wage: numOrNull(e['wage' + k]) ?? 0,
            hours_per_week: numOrNull(e['hrsPerWk' + k]) ?? 0,
          });
        }
      }
    }

    // Benefits
    const b = benByApp[appID];
    const om = numOrNull(b?.omAmount);
    const w2 = numOrNull(b?.w2Amount);
    let other_income_amount = om;
    let other_income_for = '';
    if (w2 != null && w2 > 0) {
      other_income_amount = (om ?? 0) + w2;
      other_income_for = 'includes migrated W-2 wages';
      flagged.push({ type: 'w2-fold', appID });
    }

    // Members
    const kids = (kidsByApp[appID] || []).slice().sort((x, y) => Number(x.childID) - Number(y.childID));
    if (kids.length === 0) {
      members.push({ application_id: appID, position: 1, name: fullName, relationship: 'self', sex: '', age: 0, pants: '', shirt_top: '', underwear: '', socks: '', diapers: '', gifts: '' });
      flagged.push({ type: 'synth-member', appID });
    } else {
      kids.forEach((c, idx) => {
        members.push({
          application_id: appID, position: idx + 1, name: str(c.name), relationship: '',
          sex: str(c.sex), age: numOrNull(c.age) ?? 0, pants: str(c.pantSize), shirt_top: str(c.shirtSize),
          underwear: str(c.undSize), socks: str(c.sockSize), diapers: str(c.diaperSize), gifts: str(c.gift),
        });
      });
    }

    applications.push({
      id: appID,
      season_year,
      status: str(a.approved) === '1' ? 'approved' : 'new',
      submitted_at,
      first_name: str(a.fName),
      last_name: str(a.lName),
      address: str(a.address),
      city_id: numOrNull(a.cityID) ?? 0,
      phone: str(a.phone),
      email: str(a.email),
      diabetic: bool01(a.diabetic),
      share_with_sponsor: bool01(a.tree),
      permanently_disabled: 0,
      bed_choice,
      bed_size,
      full_time_residence_confirmed: 0,
      years_received_help: 0,
      adopted_last_year: 0,
      household_type: 'family',
      no_employment_confirmed: hasEmployer ? 0 : 1,
      food_share_amount: numOrNull(b?.fsAmount),
      social_security_amount: numOrNull(b?.socAmount),
      social_security_for: '',
      ssi_amount: numOrNull(b?.ssiAmount),
      ssi_for: '',
      child_support_amount: numOrNull(b?.csAmount),
      child_support_for: '',
      unemployment_weekly_amount: null,
      unemployment_for: '',
      other_income_amount,
      other_income_for,
      good_deed: str(deedByApp[appID]?.deedText),
      may_not_be_eligible: 0,
    });
  }

  return { applications, members, employers, flagged };
}
