// Pure validation for the short elderly/disabled application (spec
// 2026-07-29-elderly-application-design.md, "The short form"). Field names/ids
// match the form in src/pages/apply/elderly.astro.
//
// This composes the EXISTING benefits/employment/good-deed validators (and
// parseIntInRange) from ./application rather than re-implementing their rules
// — those sections are identical to the family form. The about/members
// sections below are elderly-specific and are NOT a call to validateAbout /
// validateMembers, because this form asks for less than the family form does:
//   - email is OPTIONAL here (some elderly applicants have none) — the family
//     form's validateAbout requires it, so its result would never fit.
//   - full_time_residence and adopted_last_year are not asked at all — the
//     family form's validateAbout requires both and would error on every
//     elderly submission.
//   - members only ever collect name + age (no relationship/sex/sizes/gifts/
//     doll), so validateMembers's per-row rules don't apply either.
// Per house convention (see application-admin.ts), tiny generic string
// helpers (get/EMAIL_RE/rowCount) are duplicated locally rather than
// exported-and-imported from application.ts, which keeps them private to
// each validator file; the actual business-rule functions are imported.
import {
  parseIntInRange, validateBenefits, validateEmployment, validateGoodDeed, MAX_MEMBERS,
  type ApplicationInput, type Errors, type CleanApplication, type MemberClean,
} from './application';

const get = (input: ApplicationInput, key: string): string => (input[key] ?? '').trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowCount(input: ApplicationInput, key: string, max: number): number {
  // Clamp rather than reset: a tampered count never hides rows someone typed.
  const n = Number((input[key] ?? '1').trim());
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, max);
}

export type ElderlyAboutClean = {
  firstName: string;
  lastName: string;
  address: string;
  cityId: number;
  phone: string;
  email: string;
};

export function validateElderlyAbout(input: ApplicationInput, errors: Errors): ElderlyAboutClean | null {
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

  // Email is optional on this short form — but the SAME confirm-match rules
  // as the family form's about block apply once one is given.
  if (email !== '') {
    if (!EMAIL_RE.test(email)) {
      errors.email = "That email address doesn't look quite right — please check it.";
    } else if (emailConfirm === '') {
      errors.email_confirm = "Please type your email address again so we can be sure it's right.";
    } else if (emailConfirm !== email) {
      errors.email_confirm = "These two email addresses don't match — please check them.";
    }
  }

  const mine = ['first_name', 'last_name', 'address', 'city_id', 'phone', 'email', 'email_confirm'];
  if (mine.some((k) => errors[k] !== undefined)) return null;

  return { firstName, lastName, address, cityId: cityId as number, phone, email };
}

export function validateHouseholdKind(
  input: ApplicationInput,
  errors: Errors,
): 'elderly' | 'disabled' | null {
  const kind = get(input, 'household_kind');
  if (kind !== 'elderly' && kind !== 'disabled') {
    errors.household_kind = 'Please tell us which describes your household.';
    return null;
  }
  return kind;
}

// Name + age rows only (no relationship/sex/sizes/gifts/doll). Row 1 is
// always required; extra rows are skipped when fully blank and require both
// fields when partially filled — same "family-form" register as
// validateMembers, just for a slimmer row shape.
export function validateElderlyMembers(input: ApplicationInput, errors: Errors): MemberClean[] | null {
  const count = rowCount(input, 'member_count', MAX_MEMBERS);
  const members: MemberClean[] = [];
  let failed = false;

  for (let i = 1; i <= count; i++) {
    const name = get(input, `member_name_${i}`);
    const ageRaw = get(input, `member_age_${i}`);
    const allBlank = name === '' && ageRaw === '';
    if (allBlank && i > 1) continue; // blank extra row: skip

    if (name === '') errors[`member_name_${i}`] = "Please give this person's first and last name.";
    const age = parseIntInRange(ageRaw, 0, 110);
    if (age === null) errors[`member_age_${i}`] = 'Please enter their age as a number.';

    if (errors[`member_name_${i}`] || errors[`member_age_${i}`]) {
      failed = true;
      continue;
    }
    members.push({
      name,
      relationship: i === 1 ? 'self' : '',
      relationshipOther: '',
      // DELIBERATE (see file header + task-1 report): this form never asks
      // sex, so '' is the honest value. MemberClean.sex is typed 'M' | 'F';
      // application-admin.ts already casts '' through the same type for the
      // identical reason (paper entry may not record sex) — this mirrors
      // that confined, commented cast rather than widening the shared type.
      sex: '' as 'M' | 'F',
      age: age as number,
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

  if (failed) return null;
  return members;
}

export type ElderlyApplicationResult =
  | { ok: true; clean: CleanApplication & { householdType: 'elderly' | 'disabled' } }
  | { ok: false; errors: Errors };

export function validateElderlyApplication(input: ApplicationInput): ElderlyApplicationResult {
  const errors: Errors = {};

  const about = validateElderlyAbout(input, errors);
  const householdKind = validateHouseholdKind(input, errors);
  const employment = validateEmployment(input, errors);
  const benefits = validateBenefits(input, errors);
  const members = validateElderlyMembers(input, errors);
  const goodDeed = validateGoodDeed(input, errors);

  // Years received help IS asked on this form (spec), with the exact same
  // rule the family form's about block uses (parseIntInRange 0-99, required,
  // 0 = first year) — inlined here because validateAbout bundles it with
  // fields (full_time_residence, adopted_last_year) this form doesn't have.
  const years = parseIntInRange(get(input, 'years_received_help'), 0, 99);
  if (years === null) {
    errors.years_received_help =
      "Please enter how many years you've received help — enter 0 if this is your first year.";
  }

  if (
    !about || !householdKind || !employment || !benefits || !members ||
    goodDeed === null || years === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    clean: {
      ...about,
      // Deliberately NOT asked on this form (spec "Deliberately NOT asked"):
      diabetic: false,
      shareWithSponsor: false,
      fullTimeResidenceConfirmed: true,
      adoptedLastYear: false,
      bedChoice: 'none',
      bedSize: null,
      parentageNote: '',
      yearsReceivedHelp: years,
      ...employment,
      benefits,
      members,
      goodDeed,
      // IMPORTANT judgment call (see task-1 report): the app-level
      // permanently_disabled flag reads true for 'disabled' households and
      // false for 'elderly' — it mirrors the suggestHouseholdType-era
      // semantics where that flag IS the disabled signal at the household
      // level, distinct from any one member's `disabled` checkbox.
      permanentlyDisabled: householdKind === 'disabled',
      householdType: householdKind,
    },
  };
}
