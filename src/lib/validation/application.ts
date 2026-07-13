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
      errors.email_confirm = "Please type your email address again so we can be sure it's right.";
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
    errors.good_deed = "That's a little long — please shorten it to the highlights.";
    return null;
  }
  return deed;
}
