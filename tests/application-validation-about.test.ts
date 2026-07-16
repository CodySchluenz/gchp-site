import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  parseIntInRange,
  validateAbout,
  validateBedding,
  validateGoodDeed,
  type Errors,
} from '../src/lib/validation/application';

const goodAbout = {
  first_name: 'Sue',
  last_name: 'Smith',
  address: '1 Elm St',
  city_id: '13',
  phone: '608-555-0100',
  email: 'sue@example.com',
  email_confirm: 'sue@example.com',
  permanently_disabled: 'no',
  full_time_residence: 'on',
  years_received_help: '0',
  adopted_last_year: 'no',
};

describe('parseMoney', () => {
  it('accepts plain and formatted amounts', () => {
    expect(parseMoney('12')).toBe(12);
    expect(parseMoney('12.5')).toBe(12.5);
    expect(parseMoney('$1,200.50')).toBe(1200.5);
    expect(parseMoney(' 0 ')).toBe(0);
  });
  it('rejects junk and negatives', () => {
    expect(parseMoney('twelve')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('12.345')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
});

describe('parseIntInRange', () => {
  it('parses within range', () => {
    expect(parseIntInRange('7', 0, 110)).toBe(7);
    expect(parseIntInRange('0', 0, 110)).toBe(0);
  });
  it('rejects out-of-range, decimals, junk', () => {
    expect(parseIntInRange('111', 0, 110)).toBeNull();
    expect(parseIntInRange('3.5', 0, 110)).toBeNull();
    expect(parseIntInRange('x', 0, 110)).toBeNull();
  });
});

describe('validateAbout', () => {
  it('returns clean data for a complete section', () => {
    const errors: Errors = {};
    const clean = validateAbout({ ...goodAbout, diabetic: 'on' }, errors);
    expect(errors).toEqual({});
    expect(clean).toEqual({
      firstName: 'Sue',
      lastName: 'Smith',
      address: '1 Elm St',
      cityId: 13,
      phone: '608-555-0100',
      email: 'sue@example.com',
      diabetic: true,
      shareWithSponsor: false,
      fullTimeResidenceConfirmed: true,
      yearsReceivedHelp: 0,
      adoptedLastYear: false,
    });
  });

  it('requires each required field with a kind message', () => {
    const errors: Errors = {};
    expect(validateAbout({}, errors)).toBeNull();
    for (const k of [
      'first_name', 'last_name', 'address', 'city_id', 'phone', 'email',
      'full_time_residence', 'years_received_help', 'adopted_last_year',
    ]) {
      expect(errors[k], `missing error for ${k}`).toBeTruthy();
    }
  });

  it('catches an email/confirm mismatch on email_confirm', () => {
    const errors: Errors = {};
    validateAbout({ ...goodAbout, email_confirm: 'sue@examp1e.com' }, errors);
    expect(errors.email_confirm).toContain('match');
  });

  it('catches a malformed email', () => {
    const errors: Errors = {};
    validateAbout({ ...goodAbout, email: 'not-an-email', email_confirm: 'not-an-email' }, errors);
    expect(errors.email).toBeTruthy();
  });

  it('treats years_received_help = 0 as valid (first year)', () => {
    const errors: Errors = {};
    const clean = validateAbout(goodAbout, errors);
    expect(clean?.yearsReceivedHelp).toBe(0);
  });
});

describe('validateBedding', () => {
  it('requires a choice', () => {
    const errors: Errors = {};
    expect(validateBedding({}, errors)).toBeNull();
    expect(errors.bed_choice).toBeTruthy();
  });
  it('requires a size unless choice is none', () => {
    const errors: Errors = {};
    expect(validateBedding({ bed_choice: 'blanket' }, errors)).toBeNull();
    expect(errors.bed_size).toBeTruthy();
    const e2: Errors = {};
    expect(validateBedding({ bed_choice: 'none' }, e2)).toEqual({ bedChoice: 'none', bedSize: null });
  });
  it('accepts a full selection and ignores size when none', () => {
    const e: Errors = {};
    expect(validateBedding({ bed_choice: 'sheets', bed_size: 'queen' }, e)).toEqual({
      bedChoice: 'sheets',
      bedSize: 'queen',
    });
    const e2: Errors = {};
    expect(validateBedding({ bed_choice: 'none', bed_size: 'queen' }, e2)).toEqual({
      bedChoice: 'none',
      bedSize: null,
    });
  });
});

describe('validateGoodDeed', () => {
  it('requires a deed and trims it', () => {
    const errors: Errors = {};
    expect(validateGoodDeed({ good_deed: '   ' }, errors)).toBeNull();
    expect(errors.good_deed).toBeTruthy();
    const e2: Errors = {};
    expect(validateGoodDeed({ good_deed: ' I shoveled snow. ' }, e2)).toBe('I shoveled snow.');
  });
  it('caps extreme length at 5000 characters', () => {
    const errors: Errors = {};
    expect(validateGoodDeed({ good_deed: 'x'.repeat(5001) }, errors)).toBeNull();
    expect(errors.good_deed).toBeTruthy();
  });
});
