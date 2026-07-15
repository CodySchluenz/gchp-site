const DONOR_COLS = ['name', 'contact_person', 'address', 'city', 'state', 'zip', 'phone', 'email'];
const APP_COLS = ['id', 'season_year', 'status', 'submitted_at', 'first_name', 'last_name', 'address', 'city_id', 'phone', 'email', 'diabetic', 'share_with_sponsor', 'permanently_disabled', 'bed_choice', 'bed_size', 'full_time_residence_confirmed', 'years_received_help', 'adopted_last_year', 'household_type', 'no_employment_confirmed', 'food_share_amount', 'social_security_amount', 'social_security_for', 'ssi_amount', 'ssi_for', 'child_support_amount', 'child_support_for', 'unemployment_weekly_amount', 'unemployment_for', 'other_income_amount', 'other_income_for', 'good_deed', 'may_not_be_eligible'];
const MEMBER_COLS = ['application_id', 'position', 'name', 'relationship', 'sex', 'age', 'pants', 'shirt_top', 'underwear', 'socks', 'diapers', 'gifts'];
const EMPLOYER_COLS = ['application_id', 'employer_name', 'worker_name', 'hourly_wage', 'hours_per_week'];

function render(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function insertBlock(table, cols, rows) {
  if (!rows.length) return '';
  return rows
    .map((r) => `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => render(r[c])).join(',')});`)
    .join('\n') + '\n';
}

export function generateImportSql({ donors, applications, members, employers }) {
  return (
    insertBlock('donors', DONOR_COLS, donors || []) +
    insertBlock('applications', APP_COLS, applications || []) +
    insertBlock('household_members', MEMBER_COLS, members || []) +
    insertBlock('employers', EMPLOYER_COLS, employers || [])
  );
}
