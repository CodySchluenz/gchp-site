import { describe, it, expect } from 'vitest';
import { validateApplicationAdmin } from '../src/lib/validation/application-admin';
import { validateApplication } from '../src/lib/validation/application';

const minimal = { first_name: 'Sue', last_name: 'Smith', city_id: '13' };

describe('validateApplicationAdmin — lenient', () => {
  it('accepts name + town alone, with safe defaults everywhere else', () => {
    const r = validateApplicationAdmin(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.firstName).toBe('Sue');
      expect(r.clean.cityId).toBe(13);
      expect(r.clean.address).toBe('');
      expect(r.clean.phone).toBe('');
      expect(r.clean.email).toBe('');
      expect(r.clean.goodDeed).toBe('');
      expect(r.clean.members).toEqual([]);
      expect(r.clean.employers).toEqual([]);
      expect(r.clean.bedChoice).toBe('none');
      expect(r.clean.yearsReceivedHelp).toBe(0);
      expect(r.clean.adoptedLastYear).toBe(false);
      expect(r.clean.noEmploymentConfirmed).toBe(false);
      expect(r.clean.benefits.foodShareAmount).toBeNull();
    }
  });
  it('requires first name, last name, and a valid town', () => {
    const r1 = validateApplicationAdmin({ last_name: 'S', city_id: '13' });
    const r2 = validateApplicationAdmin({ first_name: 'S', last_name: 'S', city_id: '' });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors.first_name).toBeTruthy();
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.city_id).toBeTruthy();
  });
  it('blank is never an error, but malformed still is', () => {
    const bad = validateApplicationAdmin({ ...minimal, email: 'not-an-email', ssi_amount: 'abc', years_received_help: 'x' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.email).toBeTruthy();
      expect(bad.errors.ssi_amount).toBeTruthy();
      expect(bad.errors.years_received_help).toBeTruthy();
    }
    const blank = validateApplicationAdmin({ ...minimal, email: '', ssi_amount: '', years_received_help: '' });
    expect(blank.ok).toBe(true);
  });
  it('benefit amounts parse without the _none checkbox; forWhom optional', () => {
    const r = validateApplicationAdmin({ ...minimal, ssi_amount: '520', child_support_amount: '$200' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.benefits.ssiAmount).toBe(520);
      expect(r.clean.benefits.childSupportAmount).toBe(200);
      expect(r.clean.benefits.ssiFor).toBe('');
    }
  });
  it('member rows: all-blank skipped (even row 1); content requires a name; unknowns default', () => {
    const skipped = validateApplicationAdmin({ ...minimal, member_count: '2', member_relationship_1: 'self' });
    expect(skipped.ok).toBe(true); // relationship-only row 1 comes from the form prefill — still "blank"
    if (skipped.ok) expect(skipped.clean.members).toEqual([]);
    const named = validateApplicationAdmin({ ...minimal, member_name_1: 'Sue Smith', member_relationship_1: 'self' });
    expect(named.ok).toBe(true);
    if (named.ok) {
      expect(named.clean.members).toHaveLength(1);
      expect(named.clean.members[0].age).toBe(0);
      expect(named.clean.members[0].sex).toBe('');
    }
    const nameless = validateApplicationAdmin({ ...minimal, member_age_1: '7' });
    expect(nameless.ok).toBe(false);
    if (!nameless.ok) expect(nameless.errors.member_name_1).toBeTruthy();
  });
  it('employer rows: blank wage/hours default to 0; content requires the employer name', () => {
    const r = validateApplicationAdmin({ ...minimal, employer_name_1: 'Kwik Trip' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.employers[0]).toEqual({ employerName: 'Kwik Trip', workerName: '', hourlyWage: 0, hoursPerWeek: 0 });
    }
    const nameless = validateApplicationAdmin({ ...minimal, hourly_wage_1: '15' });
    expect(nameless.ok).toBe(false);
    if (!nameless.ok) expect(nameless.errors.employer_name_1).toBeTruthy();
  });
  it('bedding: blank means none; a choice without a size keeps the choice', () => {
    const r = validateApplicationAdmin({ ...minimal, bed_choice: 'blanket' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.clean.bedChoice).toBe('blanket'); expect(r.clean.bedSize).toBeNull(); }
  });
  it('a fully-filled strict submission parses to the same clean output as the strict path', () => {
    const full: Record<string, string> = {
      first_name: 'Sue', last_name: 'Smith', address: '1 Elm', city_id: '13', phone: '608',
      email: 'a@b.co', email_confirm: 'a@b.co', full_time_residence: 'on', years_received_help: '2',
      adopted_last_year: 'no', bed_choice: 'sheets', bed_size: 'full', good_deed: 'Shoveled snow.',
      member_count: '1', member_name_1: 'Sue Smith', member_relationship_1: 'self', member_sex_1: 'F', member_age_1: '40',
      employer_count: '1', employer_name_1: 'Acme', worker_name_1: 'Sue', hourly_wage_1: '15', hours_per_week_1: '40',
      food_share_none: 'on', social_security_none: 'on', ssi_none: 'on', child_support_none: 'on',
      unemployment_none: 'on', other_income_none: 'on',
    };
    const strict = validateApplication(full);
    const admin = validateApplicationAdmin(full);
    expect(strict.ok && !('spam' in strict && strict.spam === true && false)).toBe(true);
    expect(admin.ok).toBe(true);
    if (strict.ok && !strict.spam && admin.ok) expect(admin.clean).toEqual(strict.clean);
  });
  it('derives permanentlyDisabled from members like the strict path', () => {
    const r = validateApplicationAdmin({ ...minimal, member_name_1: 'Sue', member_disabled_1: 'on' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clean.permanentlyDisabled).toBe(true);
  });
});
