// Lenient validation for the ADMIN paper-entry form (2026-07-18 spec).
// The operator transcribes what is on the paper — including incomplete
// applications she needs on record (e.g. to deny). Rules: only first name,
// last name, and town are required; blank is NEVER an error; malformed values
// still get kind errors. "Unknown on paper" conventions: wage/hours/age blank
// -> 0, sex/relationship blank -> '', bedding blank -> 'none'.
// The strict public-form path (validateApplication) is untouched.
import {
  parseMoney, parseIntInRange, validateParentageNote, MAX_MEMBERS, MAX_EMPLOYERS,
  type ApplicationInput, type Errors, type CleanApplication, type MemberClean,
  type EmployerClean, type BenefitsClean,
} from './application';
import { RELATIONSHIP_VALUES } from '../relationships';

const get = (input: ApplicationInput, key: string): string => (input[key] ?? '').trim();
const isOn = (input: ApplicationInput, key: string): boolean => (input[key] ?? '') === 'on';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowCount(input: ApplicationInput, key: string, max: number): number {
  const n = Number((input[key] ?? '1').trim());
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, max);
}

const BENEFIT_KEYS = [
  { key: 'food_share', hasFor: false },
  { key: 'social_security', hasFor: true },
  { key: 'ssi', hasFor: true },
  { key: 'child_support', hasFor: true },
  { key: 'unemployment', hasFor: true },
  { key: 'other_income', hasFor: true },
] as const;

export function validateApplicationAdmin(
  input: ApplicationInput,
): { ok: true; clean: CleanApplication } | { ok: false; errors: Errors } {
  const errors: Errors = {};

  // About — only name + town required.
  const firstName = get(input, 'first_name');
  const lastName = get(input, 'last_name');
  if (firstName === '') errors.first_name = "Please enter the applicant's first name.";
  if (lastName === '') errors.last_name = "Please enter the applicant's last name.";
  const cityId = parseIntInRange(get(input, 'city_id'), 1, 9999);
  if (cityId === null) errors.city_id = 'Please pick the town from the list.';
  const email = get(input, 'email');
  if (email !== '' && !EMAIL_RE.test(email)) {
    errors.email = "That email address doesn't look quite right — please check it.";
  }
  const yearsRaw = get(input, 'years_received_help');
  const years = yearsRaw === '' ? 0 : parseIntInRange(yearsRaw, 0, 99);
  if (years === null) errors.years_received_help = 'Please enter the years as a number, or leave it blank.';

  // Bedding — blank means none; a choice without a size keeps the choice.
  const bedRaw = get(input, 'bed_choice');
  const bedChoice = bedRaw === 'sheets' || bedRaw === 'blanket' ? bedRaw : 'none';
  const sizeRaw = get(input, 'bed_size');
  const bedSize =
    bedChoice !== 'none' && (sizeRaw === 'twin' || sizeRaw === 'full' || sizeRaw === 'queen' || sizeRaw === 'king')
      ? sizeRaw
      : null;

  // Employers — blank rows skipped; content needs the employer's name;
  // blank wage/hours mean "not on the paper" and record as 0.
  const employers: EmployerClean[] = [];
  const employerCount = rowCount(input, 'employer_count', MAX_EMPLOYERS);
  for (let i = 1; i <= employerCount; i++) {
    const name = get(input, `employer_name_${i}`);
    const worker = get(input, `worker_name_${i}`);
    const wageRaw = get(input, `hourly_wage_${i}`);
    const hoursRaw = get(input, `hours_per_week_${i}`);
    if (name === '' && worker === '' && wageRaw === '' && hoursRaw === '') continue;
    if (name === '') {
      errors[`employer_name_${i}`] = "Please enter the employer's name for this row.";
      continue;
    }
    const wage = wageRaw === '' ? 0 : parseMoney(wageRaw);
    if (wage === null) errors[`hourly_wage_${i}`] = 'Please enter the wage as a number, or leave it blank.';
    const hours = hoursRaw === '' ? 0 : parseMoney(hoursRaw);
    if (hours === null || (hours ?? 0) > 168) {
      errors[`hours_per_week_${i}`] = 'Please enter hours per week as a number, or leave it blank.';
    }
    if (errors[`hourly_wage_${i}`] || errors[`hours_per_week_${i}`]) continue;
    employers.push({ employerName: name, workerName: worker, hourlyWage: wage as number, hoursPerWeek: hours as number });
  }

  // Benefits — blank amount is simply null; no _none checkbox needed; forWhom optional.
  const b: Record<string, number | null | string> = {};
  for (const { key } of BENEFIT_KEYS) {
    const amountRaw = get(input, `${key}_amount`);
    const none = isOn(input, `${key}_none`);
    let amount: number | null = null;
    if (!none && amountRaw !== '') {
      amount = parseMoney(amountRaw);
      if (amount === null) errors[`${key}_amount`] = 'Please enter the amount as a number, or leave it blank.';
    }
    b[`${key}_amount`] = amount;
    b[`${key}_for`] = none ? '' : get(input, `${key}_for`);
  }
  const benefits: BenefitsClean = {
    foodShareAmount: b.food_share_amount as number | null,
    socialSecurityAmount: b.social_security_amount as number | null,
    socialSecurityFor: b.social_security_for as string,
    ssiAmount: b.ssi_amount as number | null,
    ssiFor: b.ssi_for as string,
    childSupportAmount: b.child_support_amount as number | null,
    childSupportFor: b.child_support_for as string,
    unemploymentWeeklyAmount: b.unemployment_amount as number | null,
    unemploymentFor: b.unemployment_for as string,
    otherIncomeAmount: b.other_income_amount as number | null,
    otherIncomeFor: b.other_income_for as string,
  };

  // Members — all-blank rows skipped even for row 1 (zero members = incomplete
  // paper, allowed); a row with content needs a name; unknowns default.
  // NOTE the deliberate type loosening: paper may not say M/F, so sex may be
  // '' — D1 stores it fine and the admin UI renders '' as a dash. The cast is
  // confined to this one site.
  const members: MemberClean[] = [];
  const memberCount = rowCount(input, 'member_count', MAX_MEMBERS);
  for (let i = 1; i <= memberCount; i++) {
    const name = get(input, `member_name_${i}`);
    const relationship = get(input, `member_relationship_${i}`);
    const relationshipOther = get(input, `member_relationship_other_${i}`);
    const sexRaw = get(input, `member_sex_${i}`);
    const ageRaw = get(input, `member_age_${i}`);
    const sizes = {
      pants: get(input, `member_pants_${i}`),
      shirtTop: get(input, `member_shirt_${i}`),
      underwear: get(input, `member_underwear_${i}`),
      socks: get(input, `member_socks_${i}`),
      diapers: get(input, `member_diapers_${i}`),
      shoe: get(input, `member_shoe_${i}`),
      coat: get(input, `member_coat_${i}`),
    };
    const gifts = get(input, `member_gifts_${i}`);
    const contentBlank =
      name === '' && sexRaw === '' && ageRaw === '' && relationshipOther === '' &&
      Object.values(sizes).every((s) => s === '') && gifts === '' &&
      !isOn(input, `member_disabled_${i}`) && !isOn(input, `member_part_time_${i}`);
    if (contentBlank) continue; // relationship-only rows are form prefill, not content
    if (name === '') {
      errors[`member_name_${i}`] = "Please give this person's name, or clear the row.";
      continue;
    }
    const age = ageRaw === '' ? 0 : parseIntInRange(ageRaw, 0, 110);
    if (age === null) {
      errors[`member_age_${i}`] = 'Please enter the age as a number, or leave it blank.';
      continue;
    }
    members.push({
      name,
      relationship: RELATIONSHIP_VALUES.has(relationship) ? relationship : '',
      relationshipOther,
      sex: (sexRaw === 'M' || sexRaw === 'F' ? sexRaw : '') as 'M' | 'F',
      age,
      disabled: isOn(input, `member_disabled_${i}`),
      partTime: isOn(input, `member_part_time_${i}`),
      ...sizes,
      gifts,
    });
  }

  const goodDeedRaw = get(input, 'good_deed');
  if (goodDeedRaw.length > 5000) errors.good_deed = "That's a little long — please shorten it to the highlights.";
  const parentageNote = validateParentageNote(input, errors);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    clean: {
      firstName, lastName,
      address: get(input, 'address'),
      cityId: cityId as number,
      phone: get(input, 'phone'),
      email,
      diabetic: isOn(input, 'diabetic'),
      shareWithSponsor: isOn(input, 'share_with_sponsor'),
      fullTimeResidenceConfirmed: isOn(input, 'full_time_residence'),
      yearsReceivedHelp: years as number,
      adoptedLastYear: get(input, 'adopted_last_year') === 'yes',
      bedChoice, bedSize,
      noEmploymentConfirmed: isOn(input, 'no_employment'),
      employers, benefits, members,
      goodDeed: goodDeedRaw,
      permanentlyDisabled: members.some((m) => m.disabled === true),
      parentageNote: parentageNote ?? '',
    },
  };
}
