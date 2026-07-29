import { describe, it, expect } from 'vitest';
import { validateElderlyApplication } from '../src/lib/validation/application-elderly';

// A fully valid short-form submission (spec 2026-07-29-elderly-application-design.md).
const validPayload: Record<string, string> = {
  first_name: 'Sue',
  last_name: 'Smith',
  address: '1 Elm St',
  city_id: '13',
  phone: '608-555-0100',
  email: 'sue@example.com',
  email_confirm: 'sue@example.com',
  household_kind: 'elderly',
  years_received_help: '2',
  good_deed: 'Shoveled snow.',
  member_count: '1',
  member_name_1: 'Sue Smith',
  member_age_1: '70',
  no_employment: 'on',
  food_share_none: 'on',
  social_security_none: 'on',
  ssi_none: 'on',
  child_support_none: 'on',
  unemployment_none: 'on',
  other_income_none: 'on',
};

describe('validateElderlyApplication — about section', () => {
  it('requires first/last/address/city/phone with kind messages', () => {
    const r = validateElderlyApplication({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const k of ['first_name', 'last_name', 'address', 'city_id', 'phone']) {
        expect(r.errors[k], `missing error for ${k}`).toBeTruthy();
      }
    }
  });

  it('does NOT require full_time_residence or adopted_last_year (not asked on this form)', () => {
    const r = validateElderlyApplication({ ...validPayload, email: '', email_confirm: '' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // no such keys ever appear as errors because the field isn't on the form
      expect((r as any).errors).toBeUndefined();
    }
  });

  it('treats email as optional: blank email is fine, no confirm required', () => {
    const r = validateElderlyApplication({ ...validPayload, email: '', email_confirm: '' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clean.email).toBe('');
  });

  it('rejects a malformed email even though email is optional', () => {
    const r = validateElderlyApplication({ ...validPayload, email: 'not-an-email', email_confirm: 'not-an-email' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBeTruthy();
  });

  it('requires the confirm to match once an email is given', () => {
    const r = validateElderlyApplication({ ...validPayload, email_confirm: 'sue@examp1e.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email_confirm).toContain('match');
  });

  it('requires the confirm field at all once an email is given', () => {
    const r = validateElderlyApplication({ ...validPayload, email_confirm: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email_confirm).toBeTruthy();
  });
});

describe('validateElderlyApplication — household_kind radio', () => {
  it('is required — missing gets a kind error', () => {
    const r = validateElderlyApplication({ ...validPayload, household_kind: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.household_kind).toBe('Please tell us which describes your household.');
  });

  it('rejects a tampered/junk value kindly', () => {
    const r = validateElderlyApplication({ ...validPayload, household_kind: 'purple' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.household_kind).toBeTruthy();
  });

  it('accepts elderly and sets householdType + permanentlyDisabled false', () => {
    const r = validateElderlyApplication({ ...validPayload, household_kind: 'elderly' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.householdType).toBe('elderly');
      expect(r.clean.permanentlyDisabled).toBe(false);
    }
  });

  it('accepts disabled and sets householdType + permanentlyDisabled true', () => {
    const r = validateElderlyApplication({ ...validPayload, household_kind: 'disabled' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.householdType).toBe('disabled');
      expect(r.clean.permanentlyDisabled).toBe(true);
    }
  });
});

describe('validateElderlyApplication — members (name + age only)', () => {
  it('requires row 1 name and age', () => {
    const r = validateElderlyApplication({ ...validPayload, member_name_1: '', member_age_1: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.member_name_1).toBeTruthy();
      expect(r.errors.member_age_1).toBeTruthy();
    }
  });

  it('skips a fully-blank extra row', () => {
    const r = validateElderlyApplication({
      ...validPayload,
      member_count: '2',
      member_name_2: '',
      member_age_2: '',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clean.members).toHaveLength(1);
  });

  it('requires both name and age when an extra row is partially filled', () => {
    const nameOnly = validateElderlyApplication({
      ...validPayload,
      member_count: '2',
      member_name_2: 'Joe Smith',
      member_age_2: '',
    });
    expect(nameOnly.ok).toBe(false);
    if (!nameOnly.ok) expect(nameOnly.errors.member_age_2).toBeTruthy();

    const ageOnly = validateElderlyApplication({
      ...validPayload,
      member_count: '2',
      member_name_2: '',
      member_age_2: '68',
    });
    expect(ageOnly.ok).toBe(false);
    if (!ageOnly.ok) expect(ageOnly.errors.member_name_2).toBeTruthy();
  });

  it('accepts a second full row (elderly couple) and builds it with defaults', () => {
    const r = validateElderlyApplication({
      ...validPayload,
      member_count: '2',
      member_name_2: 'Joe Smith',
      member_age_2: '72',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.members).toHaveLength(2);
      expect(r.clean.members[1]).toEqual({
        name: 'Joe Smith',
        relationship: '',
        relationshipOther: '',
        sex: '',
        age: 72,
        pants: '',
        shirtTop: '',
        underwear: '',
        socks: '',
        diapers: '',
        shoe: '',
        coat: '',
        gifts: '',
        doll: '',
      });
    }
  });

  it('accepts age 0 and age 110 (boundaries) and rejects 111 and junk', () => {
    const ok0 = validateElderlyApplication({ ...validPayload, member_age_1: '0' });
    expect(ok0.ok).toBe(true);
    const ok110 = validateElderlyApplication({ ...validPayload, member_age_1: '110' });
    expect(ok110.ok).toBe(true);
    const bad111 = validateElderlyApplication({ ...validPayload, member_age_1: '111' });
    expect(bad111.ok).toBe(false);
    if (!bad111.ok) expect(bad111.errors.member_age_1).toBeTruthy();
    const badJunk = validateElderlyApplication({ ...validPayload, member_age_1: 'x' });
    expect(badJunk.ok).toBe(false);
    if (!badJunk.ok) expect(badJunk.errors.member_age_1).toBeTruthy();
  });

  it('sets person 1 relationship to self, sex blank, all sizes/gifts/doll blank', () => {
    const r = validateElderlyApplication(validPayload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.members[0]).toEqual({
        name: 'Sue Smith',
        relationship: 'self',
        relationshipOther: '',
        sex: '',
        age: 70,
        pants: '',
        shirtTop: '',
        underwear: '',
        socks: '',
        diapers: '',
        shoe: '',
        coat: '',
        gifts: '',
        doll: '',
      });
    }
  });
});

describe('validateElderlyApplication — years received help (matches family rule)', () => {
  it('treats 0 as valid (first year)', () => {
    const r = validateElderlyApplication({ ...validPayload, years_received_help: '0' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clean.yearsReceivedHelp).toBe(0);
  });

  it('requires it — missing/junk gets a kind message', () => {
    const missing = validateElderlyApplication({ ...validPayload, years_received_help: '' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.years_received_help).toBeTruthy();
    const junk = validateElderlyApplication({ ...validPayload, years_received_help: 'x' });
    expect(junk.ok).toBe(false);
    if (!junk.ok) expect(junk.errors.years_received_help).toBeTruthy();
  });
});

describe('validateElderlyApplication — good deed (reused verbatim)', () => {
  it('is required', () => {
    const r = validateElderlyApplication({ ...validPayload, good_deed: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.good_deed).toBeTruthy();
  });
});

describe('validateElderlyApplication — employment/benefits pass-through (composed, not duplicated)', () => {
  it('bubbles an employment error with the existing field key', () => {
    const r = validateElderlyApplication({ ...validPayload, no_employment: '', employer_name_1: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.no_employment).toBeTruthy();
  });

  it('bubbles a benefits amount error with the existing field key', () => {
    const r = validateElderlyApplication({ ...validPayload, ssi_none: '', ssi_amount: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.ssi_amount).toBeTruthy();
  });

  it('carries benefits "for whom" through to the clean output', () => {
    const r = validateElderlyApplication({
      ...validPayload,
      ssi_none: '',
      ssi_amount: '520',
      ssi_for: 'Sue',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.benefits.ssiAmount).toBe(520);
      expect(r.clean.benefits.ssiFor).toBe('Sue');
    }
  });
});

describe('validateElderlyApplication — never-wipe contract', () => {
  it('error keys match the exact field names sent, for every section at once', () => {
    const r = validateElderlyApplication({
      household_kind: 'nope',
      member_name_1: '',
      member_age_1: 'x',
      years_received_help: '',
      good_deed: '',
      food_share_none: 'on',
      social_security_none: 'on',
      ssi_none: '',
      ssi_amount: 'abc',
      child_support_none: 'on',
      unemployment_none: 'on',
      other_income_none: 'on',
      no_employment: '',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        [
          'first_name', 'last_name', 'address', 'city_id', 'phone',
          'household_kind', 'member_name_1', 'member_age_1',
          'years_received_help', 'good_deed', 'ssi_amount', 'no_employment',
        ].sort(),
      );
    }
  });
});

describe('validateElderlyApplication — full ok case defaults', () => {
  it('produces the exact spec defaults for fields not asked on this form', () => {
    const r = validateElderlyApplication(validPayload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clean.bedChoice).toBe('none');
      expect(r.clean.bedSize).toBeNull();
      expect(r.clean.diabetic).toBe(false);
      expect(r.clean.shareWithSponsor).toBe(false);
      expect(r.clean.fullTimeResidenceConfirmed).toBe(true);
      expect(r.clean.adoptedLastYear).toBe(false);
      expect(r.clean.parentageNote).toBe('');
      expect(r.clean.firstName).toBe('Sue');
      expect(r.clean.lastName).toBe('Smith');
      expect(r.clean.cityId).toBe(13);
      expect(r.clean.phone).toBe('608-555-0100');
    }
  });
});
