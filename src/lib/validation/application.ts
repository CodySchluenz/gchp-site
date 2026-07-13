// Pure validation for the one-page application form (spec §3).
// Field names/ids match the form in src/pages/apply.astro exactly.
// Error messages are warm and specific: the audience is stressed,
// possibly elderly, non-technical applicants.

export type ApplicationInput = Record<string, string>;
export type Errors = Record<string, string>;

export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export function parseIntInRange(raw: string, min: number, max: number): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const get = (input: ApplicationInput, key: string): string => (input[key] ?? '').trim();
const isOn = (input: ApplicationInput, key: string): boolean => (input[key] ?? '') === 'on';

export type AboutClean = {
  firstName: string;
  lastName: string;
  address: string;
  cityId: number;
  phone: string;
  email: string;
  diabetic: boolean;
  permanentlyDisabled: boolean;
  shareWithSponsor: boolean;
  fullTimeResidenceConfirmed: boolean;
  yearsReceivedHelp: number;
  adoptedLastYear: boolean;
};

export function validateAbout(input: ApplicationInput, errors: Errors): AboutClean | null {
  const firstName = get(input, 'first_name');
  const lastName = get(input, 'last_name');
  const address = get(input, 'address');
  const phone = get(input, 'phone');
  const email = get(input, 'email');
  const emailConfirm = get(input, 'email_confirm');

  if (firstName === '') errors.first_name = 'Please tell us your first name.';
  if (lastName === '') errors.last_name = 'Please tell us your last name.';
  if (address === '') errors.address = 'Please tell us your street address.';

  const cityId = parseIntInRange(get(input, 'city_id'), 1, 9999);
  if (cityId === null) errors.city_id = 'Please pick your town from the list.';

  if (phone === '') errors.phone = 'We need your phone number so we can reach you about pickup.';

  if (email === '') {
    errors.email = 'Please enter your email address — we use it to send your approval.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "That email address doesn't look quite right — please check it.";
  }
  if (email !== '' && errors.email === undefined) {
    if (emailConfirm === '') {
      errors.email_confirm = "Please type your email address again so we can be sure it’s right.";
    } else if (emailConfirm !== email) {
      errors.email_confirm = "These two email addresses don't match — please check them.";
    }
  }

  const disabled = get(input, 'permanently_disabled');
  if (disabled !== 'yes' && disabled !== 'no') {
    errors.permanently_disabled = 'Please answer yes or no.';
  }

  if (!isOn(input, 'full_time_residence')) {
    errors.full_time_residence =
      'Please check this box to confirm everyone you list lives at your address full-time.';
  }

  const years = parseIntInRange(get(input, 'years_received_help'), 0, 99);
  if (years === null) {
    errors.years_received_help =
      "Please enter how many years you've received help — enter 0 if this is your first year.";
  }

  const adopted = get(input, 'adopted_last_year');
  if (adopted !== 'yes' && adopted !== 'no') {
    errors.adopted_last_year = 'Please answer yes or no.';
  }

  const mine = [
    'first_name', 'last_name', 'address', 'city_id', 'phone', 'email', 'email_confirm',
    'permanently_disabled', 'full_time_residence', 'years_received_help', 'adopted_last_year',
  ];
  if (mine.some((k) => errors[k] !== undefined)) return null;

  return {
    firstName,
    lastName,
    address,
    cityId: cityId as number,
    phone,
    email,
    diabetic: isOn(input, 'diabetic'),
    permanentlyDisabled: disabled === 'yes',
    shareWithSponsor: isOn(input, 'share_with_sponsor'),
    fullTimeResidenceConfirmed: true,
    yearsReceivedHelp: years as number,
    adoptedLastYear: adopted === 'yes',
  };
}

export type BeddingClean = {
  bedChoice: 'sheets' | 'blanket' | 'none';
  bedSize: 'twin' | 'full' | 'queen' | 'king' | null;
};

export function validateBedding(input: ApplicationInput, errors: Errors): BeddingClean | null {
  const choice = get(input, 'bed_choice');
  if (choice !== 'sheets' && choice !== 'blanket' && choice !== 'none') {
    errors.bed_choice = 'Please choose sheets, a blanket, or "no thank you."';
    return null;
  }
  if (choice === 'none') return { bedChoice: 'none', bedSize: null };
  const size = get(input, 'bed_size');
  if (size !== 'twin' && size !== 'full' && size !== 'queen' && size !== 'king') {
    errors.bed_size = 'Please pick a size so we bring the right one.';
    return null;
  }
  return { bedChoice: choice, bedSize: size };
}

export function validateGoodDeed(input: ApplicationInput, errors: Errors): string | null {
  const deed = get(input, 'good_deed');
  if (deed === '') {
    errors.good_deed = 'Please tell us about one good deed — a sentence or two is plenty.';
    return null;
  }
  if (deed.length > 5000) {
    errors.good_deed = "That’s a little long — please shorten it to the highlights.";
    return null;
  }
  return deed;
}

export const MAX_MEMBERS = 15;
export const MAX_EMPLOYERS = 10;

function rowCount(input: ApplicationInput, key: string, max: number): number {
  // Clamp rather than reset: a tampered count never hides rows someone typed.
  const n = Number((input[key] ?? '1').trim());
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, max);
}

export type EmployerClean = {
  employerName: string;
  workerName: string;
  hourlyWage: number;
  hoursPerWeek: number;
};

export function validateEmployment(
  input: ApplicationInput,
  errors: Errors,
): { noEmploymentConfirmed: boolean; employers: EmployerClean[] } | null {
  const count = rowCount(input, 'employer_count', MAX_EMPLOYERS);
  const noEmployment = isOn(input, 'no_employment');
  const employers: EmployerClean[] = [];
  let rowErrors = false;

  for (let i = 1; i <= count; i++) {
    const name = get(input, `employer_name_${i}`);
    const worker = get(input, `worker_name_${i}`);
    const wageRaw = get(input, `hourly_wage_${i}`);
    const hoursRaw = get(input, `hours_per_week_${i}`);
    if (name === '' && worker === '' && wageRaw === '' && hoursRaw === '') continue; // blank row: skip

    if (name === '') errors[`employer_name_${i}`] = "Please tell us the employer's name.";
    if (worker === '') errors[`worker_name_${i}`] = 'Please tell us who works this job.';
    const wage = parseMoney(wageRaw);
    if (wage === null)
      errors[`hourly_wage_${i}`] = 'Please enter the hourly wage as a number, like 15.50.';
    const hours = parseMoney(hoursRaw);
    if (hours === null || hours > 168)
      errors[`hours_per_week_${i}`] = 'Please enter hours per week as a number, like 32.';

    if (
      errors[`employer_name_${i}`] || errors[`worker_name_${i}`] ||
      errors[`hourly_wage_${i}`] || errors[`hours_per_week_${i}`]
    ) {
      rowErrors = true;
      continue;
    }
    employers.push({
      employerName: name,
      workerName: worker,
      hourlyWage: wage as number,
      hoursPerWeek: hours as number,
    });
  }

  if (noEmployment && (employers.length > 0 || rowErrors)) {
    errors.no_employment =
      "You've checked \"no one is employed\" but also listed a job — please clear one or the other.";
    return null;
  }
  if (!noEmployment && employers.length === 0 && !rowErrors) {
    errors.no_employment =
      'Please list at least one job, or check the box that says no one in your household is employed.';
    return null;
  }
  if (rowErrors) return null;
  return { noEmploymentConfirmed: noEmployment, employers };
}

export type BenefitsClean = {
  foodShareAmount: number | null;
  socialSecurityAmount: number | null;
  socialSecurityFor: string;
  ssiAmount: number | null;
  ssiFor: string;
  childSupportAmount: number | null;
  childSupportFor: string;
  unemploymentWeeklyAmount: number | null;
  unemploymentFor: string;
  otherIncomeAmount: number | null;
  otherIncomeFor: string;
};

const BENEFIT_KEYS = [
  { key: 'food_share', hasFor: false },
  { key: 'social_security', hasFor: true },
  { key: 'ssi', hasFor: true },
  { key: 'child_support', hasFor: true },
  { key: 'unemployment', hasFor: true },
  { key: 'other_income', hasFor: true },
] as const;

export function validateBenefits(input: ApplicationInput, errors: Errors): BenefitsClean | null {
  const out: Record<string, number | null | string> = {};
  let failed = false;

  for (const { key, hasFor } of BENEFIT_KEYS) {
    const none = isOn(input, `${key}_none`);
    const amountRaw = get(input, `${key}_amount`);
    const forWhom = get(input, `${key}_for`);
    let amount: number | null = null;

    if (none) {
      amount = null;
    } else if (amountRaw === '') {
      errors[`${key}_amount`] =
        "Please enter an amount, or check the box that says you don't receive this.";
      failed = true;
    } else {
      const parsed = parseMoney(amountRaw);
      if (parsed === null) {
        errors[`${key}_amount`] = 'Please enter the amount as a number, like 250 — no letters needed.';
        failed = true;
      } else {
        amount = parsed;
        if (hasFor && forWhom === '') {
          errors[`${key}_for`] = 'Please tell us who in your household receives this.';
          failed = true;
        }
      }
    }
    out[`${key}_amount`] = amount;
    out[`${key}_for`] = none ? '' : forWhom;
  }
  if (failed) return null;

  return {
    foodShareAmount: out.food_share_amount as number | null,
    socialSecurityAmount: out.social_security_amount as number | null,
    socialSecurityFor: out.social_security_for as string,
    ssiAmount: out.ssi_amount as number | null,
    ssiFor: out.ssi_for as string,
    childSupportAmount: out.child_support_amount as number | null,
    childSupportFor: out.child_support_for as string,
    unemploymentWeeklyAmount: out.unemployment_amount as number | null,
    unemploymentFor: out.unemployment_for as string,
    otherIncomeAmount: out.other_income_amount as number | null,
    otherIncomeFor: out.other_income_for as string,
  };
}

export type MemberClean = {
  name: string;
  relationship: string;
  sex: 'M' | 'F';
  age: number;
  pants: string;
  shirtTop: string;
  underwear: string;
  socks: string;
  diapers: string;
  gifts: string;
};

export function validateMembers(input: ApplicationInput, errors: Errors): MemberClean[] | null {
  const count = rowCount(input, 'member_count', MAX_MEMBERS);
  const members: MemberClean[] = [];
  let failed = false;

  for (let i = 1; i <= count; i++) {
    const name = get(input, `member_name_${i}`);
    const relationship = get(input, `member_relationship_${i}`);
    const sex = get(input, `member_sex_${i}`);
    const ageRaw = get(input, `member_age_${i}`);
    const sizes = {
      pants: get(input, `member_pants_${i}`),
      shirtTop: get(input, `member_shirt_${i}`),
      underwear: get(input, `member_underwear_${i}`),
      socks: get(input, `member_socks_${i}`),
      diapers: get(input, `member_diapers_${i}`),
    };
    const gifts = get(input, `member_gifts_${i}`);

    const allBlank =
      name === '' && relationship === '' && sex === '' && ageRaw === '' &&
      Object.values(sizes).every((s) => s === '') && gifts === '';
    if (allBlank && i > 1) continue; // blank extra card: skip

    if (name === '') errors[`member_name_${i}`] = "Please give this person's first and last name.";
    if (relationship === '')
      errors[`member_relationship_${i}`] = "Please tell us how they're related to you (write \"self\" for yourself).";
    if (sex !== 'M' && sex !== 'F') errors[`member_sex_${i}`] = 'Please pick one.';
    const age = parseIntInRange(ageRaw, 0, 110);
    if (age === null) errors[`member_age_${i}`] = 'Please enter their age as a number.';

    if (
      errors[`member_name_${i}`] || errors[`member_relationship_${i}`] ||
      errors[`member_sex_${i}`] || errors[`member_age_${i}`]
    ) {
      failed = true;
      continue;
    }
    members.push({ name, relationship, sex: sex as 'M' | 'F', age: age as number, ...sizes, gifts });
  }

  if (failed) return null;
  return members;
}

export type CleanApplication = AboutClean &
  BeddingClean & {
    noEmploymentConfirmed: boolean;
    employers: EmployerClean[];
    benefits: BenefitsClean;
    members: MemberClean[];
    goodDeed: string;
  };

export type ApplicationResult =
  | { ok: true; spam: true }
  | { ok: true; spam: false; clean: CleanApplication }
  | { ok: false; errors: Errors };

export function validateApplication(input: ApplicationInput): ApplicationResult {
  if ((input.website ?? '').trim() !== '') return { ok: true, spam: true };

  const errors: Errors = {};
  const about = validateAbout(input, errors);
  const bedding = validateBedding(input, errors);
  const employment = validateEmployment(input, errors);
  const benefits = validateBenefits(input, errors);
  const members = validateMembers(input, errors);
  const goodDeed = validateGoodDeed(input, errors);

  if (!about || !bedding || !employment || !benefits || !members || goodDeed === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    spam: false,
    clean: { ...about, ...bedding, ...employment, benefits, members, goodDeed },
  };
}
