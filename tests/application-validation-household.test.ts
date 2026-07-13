import { describe, it, expect } from 'vitest';
import {
  validateEmployment,
  validateBenefits,
  validateMembers,
  validateApplication,
  MAX_MEMBERS,
  MAX_EMPLOYERS,
  type Errors,
} from '../src/lib/validation/application';

const noBenefits = {
  food_share_none: 'on', social_security_none: 'on', ssi_none: 'on',
  child_support_none: 'on', unemployment_none: 'on', other_income_none: 'on',
};

const fullValid = {
  first_name: 'Sue', last_name: 'Smith', address: '1 Elm St', city_id: '13',
  phone: '608-555-0100', email: 'sue@example.com', email_confirm: 'sue@example.com',
  permanently_disabled: 'no', full_time_residence: 'on',
  years_received_help: '2', adopted_last_year: 'no',
  bed_choice: 'blanket', bed_size: 'queen',
  employer_count: '1', employer_name_1: 'Acme', worker_name_1: 'Sue Smith',
  hourly_wage_1: '15.50', hours_per_week_1: '32',
  ...noBenefits,
  member_count: '2',
  member_name_1: 'Sue Smith', member_relationship_1: 'self', member_sex_1: 'F', member_age_1: '34',
  member_name_2: 'Tim Smith', member_relationship_2: 'son', member_sex_2: 'M', member_age_2: '7',
  member_pants_2: '8', member_gifts_2: 'legos',
  good_deed: "I shoveled my neighbor’s snow all winter.",
};

describe('validateEmployment', () => {
  it('accepts a complete employer row', () => {
    const errors: Errors = {};
    const r = validateEmployment(fullValid, errors);
    expect(errors).toEqual({});
    expect(r).toEqual({
      noEmploymentConfirmed: false,
      employers: [{ employerName: 'Acme', workerName: 'Sue Smith', hourlyWage: 15.5, hoursPerWeek: 32 }],
    });
  });

  it('requires either a job or the no-employment box', () => {
    const errors: Errors = {};
    expect(validateEmployment({ employer_count: '1' }, errors)).toBeNull();
    expect(errors.no_employment).toBeTruthy();
  });

  it('accepts the no-employment box with zero rows', () => {
    const errors: Errors = {};
    expect(validateEmployment({ employer_count: '1', no_employment: 'on' }, errors)).toEqual({
      noEmploymentConfirmed: true,
      employers: [],
    });
  });

  it('rejects the box AND a filled row together', () => {
    const errors: Errors = {};
    expect(validateEmployment({ ...fullValid, no_employment: 'on' }, errors)).toBeNull();
    expect(errors.no_employment).toContain('clear');
  });

  it('errors each missing field of a partially-filled row', () => {
    const errors: Errors = {};
    validateEmployment({ employer_count: '1', employer_name_1: 'Acme' }, errors);
    expect(errors.worker_name_1).toBeTruthy();
    expect(errors.hourly_wage_1).toBeTruthy();
    expect(errors.hours_per_week_1).toBeTruthy();
  });

  it('skips a fully blank extra row', () => {
    const errors: Errors = {};
    const r = validateEmployment({ ...fullValid, employer_count: '2' }, errors);
    expect(errors).toEqual({});
    expect(r?.employers).toHaveLength(1);
  });
});

describe('validateBenefits', () => {
  it('requires an answer for every benefit row', () => {
    const errors: Errors = {};
    expect(validateBenefits({}, errors)).toBeNull();
    for (const k of ['food_share', 'social_security', 'ssi', 'child_support', 'unemployment', 'other_income']) {
      expect(errors[`${k}_amount`], `missing error for ${k}`).toBeTruthy();
    }
  });

  it('requires who-receives-it when an amount is given (except food share)', () => {
    const errors: Errors = {};
    validateBenefits({ ...noBenefits, ssi_none: '', ssi_amount: '450' }, errors);
    expect(errors.ssi_for).toBeTruthy();
  });

  it('food share needs no for-whom', () => {
    const errors: Errors = {};
    const r = validateBenefits({ ...noBenefits, food_share_none: '', food_share_amount: '250' }, errors);
    expect(errors).toEqual({});
    expect(r?.foodShareAmount).toBe(250);
  });

  it('none-checked rows come back null with empty for', () => {
    const errors: Errors = {};
    const r = validateBenefits(noBenefits, errors);
    expect(r).toEqual({
      foodShareAmount: null,
      socialSecurityAmount: null, socialSecurityFor: '',
      ssiAmount: null, ssiFor: '',
      childSupportAmount: null, childSupportFor: '',
      unemploymentWeeklyAmount: null, unemploymentFor: '',
      otherIncomeAmount: null, otherIncomeFor: '',
    });
  });

  it('rejects an unparseable amount kindly', () => {
    const errors: Errors = {};
    validateBenefits({ ...noBenefits, ssi_none: '', ssi_amount: 'four hundred', ssi_for: 'me' }, errors);
    expect(errors.ssi_amount).toContain('number');
  });
});

describe('validateMembers', () => {
  it('accepts the two-member household and blank sizes mean not-needed', () => {
    const errors: Errors = {};
    const r = validateMembers(fullValid, errors);
    expect(errors).toEqual({});
    expect(r).toHaveLength(2);
    expect(r?.[0]).toMatchObject({ name: 'Sue Smith', relationship: 'self', sex: 'F', age: 34, pants: '' });
    expect(r?.[1]).toMatchObject({ name: 'Tim Smith', age: 7, pants: '8', gifts: 'legos' });
  });

  it('requires person 1 even when blank', () => {
    const errors: Errors = {};
    expect(validateMembers({ member_count: '1' }, errors)).toBeNull();
    expect(errors.member_name_1).toBeTruthy();
    expect(errors.member_relationship_1).toBeTruthy();
    expect(errors.member_sex_1).toBeTruthy();
    expect(errors.member_age_1).toBeTruthy();
  });

  it('skips a fully blank extra card but errors a partial one', () => {
    const e1: Errors = {};
    const r1 = validateMembers({ ...fullValid, member_count: '3' }, e1);
    expect(e1).toEqual({});
    expect(r1).toHaveLength(2);
    const e2: Errors = {};
    validateMembers({ ...fullValid, member_count: '3', member_name_3: 'Baby' }, e2);
    expect(e2.member_age_3).toBeTruthy();
  });

  it('rejects an age outside 0-110', () => {
    const errors: Errors = {};
    validateMembers({ ...fullValid, member_age_2: '190' }, errors);
    expect(errors.member_age_2).toBeTruthy();
  });
});

describe('validateApplication', () => {
  it('returns spam for a filled honeypot', () => {
    expect(validateApplication({ ...fullValid, website: 'http://spam' })).toEqual({ ok: true, spam: true });
  });

  it('assembles a clean application from valid input', () => {
    const r = validateApplication(fullValid);
    expect(r.ok).toBe(true);
    if (r.ok && !r.spam) {
      expect(r.clean.firstName).toBe('Sue');
      expect(r.clean.bedChoice).toBe('blanket');
      expect(r.clean.employers).toHaveLength(1);
      expect(r.clean.members).toHaveLength(2);
      expect(r.clean.benefits.ssiAmount).toBeNull();
      expect(r.clean.goodDeed).toContain('shoveled');
    }
  });

  it('collects errors across all sections at once', () => {
    const r = validateApplication({ member_count: '1', employer_count: '1' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.first_name).toBeTruthy();
      expect(r.errors.bed_choice).toBeTruthy();
      expect(r.errors.no_employment).toBeTruthy();
      expect(r.errors.food_share_amount).toBeTruthy();
      expect(r.errors.member_name_1).toBeTruthy();
      expect(r.errors.good_deed).toBeTruthy();
    }
  });

  it('clamps runaway counts', () => {
    const r = validateApplication({ ...fullValid, member_count: '9999', employer_count: '9999' });
    expect(r.ok).toBe(true);
    expect(MAX_MEMBERS).toBe(15);
    expect(MAX_EMPLOYERS).toBe(10);
  });
});
