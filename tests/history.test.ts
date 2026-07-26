import { describe, it, expect } from 'vitest';
import {
  describeApplicationChanges, describeMemberChange, describeEmployerChange,
  describeCardsChanges, describePuChange, describeDecision,
} from '../src/lib/history';
import type { ApplicationFullEdit, MemberEdit, EmployerEdit, CardsGiven } from '../src/lib/db';

const cityName = (id: number) => (id === 13 ? 'Lancaster' : id === 15 ? 'Platteville' : `Town #${id}`);

// A current row and a matching "no changes" edit — build the edit FROM the row.
const row: Record<string, unknown> = {
  first_name: 'Sue', last_name: 'Smith', address: '1 Elm', city_id: 13, phone: '', email: 'a@b.co',
  diabetic: 0, share_with_sponsor: 0, permanently_disabled: 0, bed_choice: 'none', bed_size: null,
  years_received_help: 2, adopted_last_year: 0, household_type: 'family',
  full_time_residence_confirmed: 1, no_employment_confirmed: 1,
  food_share_amount: null, social_security_amount: 800, social_security_for: 'self',
  ssi_amount: null, ssi_for: '', child_support_amount: null, child_support_for: '',
  unemployment_weekly_amount: null, unemployment_for: '', other_income_amount: null, other_income_for: '',
  good_deed: 'Shoveled snow', parentage_note: '',
};
const same: ApplicationFullEdit = {
  firstName: 'Sue', lastName: 'Smith', address: '1 Elm', cityId: 13, phone: '', email: 'a@b.co',
  diabetic: false, shareWithSponsor: false, permanentlyDisabled: false, bedChoice: 'none', bedSize: null,
  yearsReceivedHelp: 2, adoptedLastYear: false, householdType: 'family',
  fullTimeResidenceConfirmed: true, noEmploymentConfirmed: true,
  foodShareAmount: null, socialSecurityAmount: 800, socialSecurityFor: 'self',
  ssiAmount: null, ssiFor: '', childSupportAmount: null, childSupportFor: '',
  unemploymentWeeklyAmount: null, unemploymentFor: '', otherIncomeAmount: null, otherIncomeFor: '',
  goodDeed: 'Shoveled snow', parentageNote: '',
};

describe('describeApplicationChanges', () => {
  it('returns no rows when nothing changed', () => {
    expect(describeApplicationChanges(row, same, cityName)).toEqual([]);
  });
  it('describes short-field changes with old and new values', () => {
    const out = describeApplicationChanges(row, {
      ...same, address: '2 Oak', phone: '608-555-0142', cityId: 15,
      socialSecurityAmount: 650, diabetic: true, bedChoice: 'blanket', bedSize: 'full',
    }, cityName);
    expect(out).toContain('Address changed from 1 Elm to 2 Oak');
    expect(out).toContain('Phone changed from blank to 608-555-0142');
    expect(out).toContain('Town changed from Lancaster to Platteville');
    expect(out).toContain('Social Security (monthly) changed from $800 to $650');
    expect(out).toContain('Diabetic changed from No to Yes');
    expect(out).toContain('Bed choice changed from none to blanket');
    expect(out).toContain('Bed size changed from blank to full');
  });
  it('long text logs updated-style without values', () => {
    const out = describeApplicationChanges(row, { ...same, goodDeed: 'Different deed', parentageNote: 'Dad has them Mondays' }, cityName);
    expect(out).toContain('Good deed was edited');
    expect(out).toContain('Blended-family note was edited');
    expect(out.join(' ')).not.toContain('Different deed');
  });
  it('formats cents only when present', () => {
    const out = describeApplicationChanges(row, { ...same, socialSecurityAmount: 650.5 }, cityName);
    expect(out).toContain('Social Security (monthly) changed from $800 to $650.50');
  });
});

const memberRow: Record<string, unknown> = {
  name: 'Tim Smith', relationship: 'son', relationship_other: '', sex: 'M', age: 7,
  disabled: 0, part_time: 0, doll: '', pants: '8', shirt_top: 'M', underwear: '8', socks: '', diapers: '', shoe: '2', coat: 'M', gifts: 'bike',
};
const sameMember: MemberEdit = {
  name: 'Tim Smith', relationship: 'son', relationshipOther: '', sex: 'M', age: 7,
  disabled: false, partTime: false, doll: '', pants: '8', shirtTop: 'M', underwear: '8', socks: '', diapers: '', shoe: '2', coat: 'M', gifts: 'bike',
};

describe('describeMemberChange', () => {
  it('add / remove / restore', () => {
    expect(describeMemberChange('added', null, sameMember)).toEqual(['Person added: Tim Smith']);
    expect(describeMemberChange('removed', memberRow, null)).toEqual(['Tim Smith removed']);
    expect(describeMemberChange('restored', memberRow, null)).toEqual(['Tim Smith restored']);
  });
  it('updates: per-field rows prefixed with the name; rename gets its own row', () => {
    const out = describeMemberChange('updated', memberRow, { ...sameMember, name: 'Timothy Smith', coat: 'L', doll: 'non_white', age: 8 });
    expect(out).toContain('Person renamed from Tim Smith to Timothy Smith');
    expect(out).toContain('Timothy Smith: coat size changed from M to L');
    expect(out).toContain('Timothy Smith: doll changed from No doll to Non-White doll');
    expect(out).toContain('Timothy Smith: age changed from 7 to 8');
    expect(describeMemberChange('updated', memberRow, sameMember)).toEqual([]);
  });
});

const employerRow: Record<string, unknown> = { employer_name: 'Acme', worker_name: 'Sue', hourly_wage: 15, hours_per_week: 40 };
const sameEmployer: EmployerEdit = { employerName: 'Acme', workerName: 'Sue', hourlyWage: 15, hoursPerWeek: 40 };

describe('describeEmployerChange', () => {
  it('add / remove / restore / update', () => {
    expect(describeEmployerChange('added', null, sameEmployer)).toEqual(['Job added: Sue at Acme ($15 x 40 hrs)']);
    expect(describeEmployerChange('removed', employerRow, null)).toEqual(['Job at Acme removed']);
    expect(describeEmployerChange('restored', employerRow, null)).toEqual(['Job at Acme restored']);
    const out = describeEmployerChange('updated', employerRow, { ...sameEmployer, hoursPerWeek: 32, hourlyWage: 15.5 });
    expect(out).toContain('Job at Acme: hours per week changed from 40 to 32');
    expect(out).toContain('Job at Acme: hourly wage changed from $15 to $15.50');
    expect(describeEmployerChange('updated', employerRow, sameEmployer)).toEqual([]);
  });
});

describe('cards / pickup number / decision', () => {
  const cardsRow: Record<string, unknown> = { thanksgiving_card: 0, food_card: 0, food_card_amount: null, gift_card: 1, gift_card_amount: 25 };
  it('cards: one row per changed item', () => {
    const out = describeCardsChanges(cardsRow, { thanksgivingCard: true, foodCard: true, foodCardAmount: 50, giftCard: true, giftCardAmount: 40 });
    expect(out).toContain('Thanksgiving card marked given');
    expect(out).toContain('Food card marked given ($50)');
    expect(out).toContain('Gift card amount changed from $25 to $40');
    expect(describeCardsChanges(cardsRow, { thanksgivingCard: false, foodCard: false, foodCardAmount: null, giftCard: true, giftCardAmount: 25 })).toEqual([]);
  });
  it('unmarking', () => {
    const out = describeCardsChanges({ ...cardsRow, thanksgiving_card: 1 }, { thanksgivingCard: false, foodCard: false, foodCardAmount: null, giftCard: true, giftCardAmount: 25 });
    expect(out).toContain('Thanksgiving card unmarked');
  });
  it('pickup number', () => {
    expect(describePuChange(null, 1610)).toBe('Pickup number set to 1610');
    expect(describePuChange(1604, 1610)).toBe('Pickup number changed from 1604 to 1610');
    expect(describePuChange(1604, null)).toBe('Pickup number cleared');
    expect(describePuChange(1604, 1604)).toBeNull();
  });
  it('decisions', () => {
    expect(describeDecision('approved', 1604, 'sent')).toBe('Approved; pickup number 1604 assigned — email sent');
    expect(describeDecision('approved', null, 'none')).toBe('Approved (no number free in the block)');
    expect(describeDecision('approved', undefined, 'none')).toBe('Approved');
    expect(describeDecision('denied', undefined, 'failed')).toBe('Denied — email could not be sent');
  });
});

describe('copy hygiene', () => {
  it('no curly apostrophes in any composed sentence', () => {
    const all = [
      ...describeApplicationChanges(row, { ...same, address: '2 Oak' }, cityName),
      ...describeMemberChange('added', null, sameMember),
      describeDecision('approved', 1604, 'sent'),
    ].join('');
    expect(all.includes('’')).toBe(false);
  });
});
