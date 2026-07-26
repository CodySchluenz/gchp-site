// The sentence composers for the application History timeline. Pure functions:
// each takes the CURRENT stored values (snake_case row) and the incoming edit
// (camelCase), and returns plain-English sentences for whatever changed.
// The save paths in the admin routes write these via addHistory/historyStatements.
// Long free-text fields deliberately log "was edited" without values — the
// timeline stays readable, and the original text lives in original_json.
import type { ApplicationFullEdit, MemberEdit, EmployerEdit, CardsGiven } from './db';
import { relationshipLabel } from './relationships';

const money = (v: number | null | undefined): string =>
  v == null ? 'blank' : Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
const blank = (s: string | null | undefined): string => (s == null || s === '' ? 'blank' : s);
const yesNo = (b: boolean): string => (b ? 'Yes' : 'No');
const dollLabel = (d: string | null | undefined): string =>
  d === 'white' ? 'White doll' : d === 'non_white' ? 'Non-White doll' : 'No doll';

type Field =
  | { label: string; old: string; next: string }         // compared as strings
  | { label: string; edited: true; old: string; next: string }; // long text: "was edited"

function diff(fields: Field[]): string[] {
  const out: string[] = [];
  for (const f of fields) {
    if (f.old === f.next) continue;
    out.push('edited' in f ? `${f.label} was edited` : `${f.label} changed from ${f.old} to ${f.next}`);
  }
  return out;
}

export function describeApplicationChanges(
  current: Record<string, unknown>, next: ApplicationFullEdit, cityName: (id: number) => string,
): string[] {
  const s = (v: unknown) => blank(v == null ? '' : String(v));
  const n = (v: unknown): number | null => (v == null ? null : Number(v));
  const b = (v: unknown) => yesNo(v === 1 || v === true);
  return diff([
    { label: 'First name', old: s(current.first_name), next: blank(next.firstName) },
    { label: 'Last name', old: s(current.last_name), next: blank(next.lastName) },
    { label: 'Address', old: s(current.address), next: blank(next.address) },
    { label: 'Town', old: cityName(Number(current.city_id)), next: cityName(next.cityId) },
    { label: 'Phone', old: s(current.phone), next: blank(next.phone) },
    { label: 'Email', old: s(current.email), next: blank(next.email) },
    { label: 'Diabetic', old: b(current.diabetic), next: yesNo(next.diabetic) },
    { label: 'OK to share with a sponsor', old: b(current.share_with_sponsor), next: yesNo(next.shareWithSponsor) },
    { label: 'Permanently disabled', old: b(current.permanently_disabled), next: yesNo(next.permanentlyDisabled) },
    { label: 'Bed choice', old: s(current.bed_choice), next: blank(next.bedChoice) },
    { label: 'Bed size', old: s(current.bed_size), next: blank(next.bedSize) },
    { label: 'Years received help', old: s(current.years_received_help), next: String(next.yearsReceivedHelp) },
    { label: 'Adopted last year', old: b(current.adopted_last_year), next: yesNo(next.adoptedLastYear) },
    { label: 'Household type', old: s(current.household_type), next: next.householdType },
    { label: 'Residence confirmed', old: b(current.full_time_residence_confirmed), next: yesNo(next.fullTimeResidenceConfirmed) },
    { label: 'No one employed confirmed', old: b(current.no_employment_confirmed), next: yesNo(next.noEmploymentConfirmed) },
    { label: 'Food Share (monthly)', old: money(n(current.food_share_amount)), next: money(next.foodShareAmount) },
    { label: 'Social Security (monthly)', old: money(n(current.social_security_amount)), next: money(next.socialSecurityAmount) },
    { label: 'Social Security is for', old: s(current.social_security_for), next: blank(next.socialSecurityFor) },
    { label: 'SSI (monthly)', old: money(n(current.ssi_amount)), next: money(next.ssiAmount) },
    { label: 'SSI is for', old: s(current.ssi_for), next: blank(next.ssiFor) },
    { label: 'Child support (monthly)', old: money(n(current.child_support_amount)), next: money(next.childSupportAmount) },
    { label: 'Child support is for', old: s(current.child_support_for), next: blank(next.childSupportFor) },
    { label: 'Unemployment (weekly)', old: money(n(current.unemployment_weekly_amount)), next: money(next.unemploymentWeeklyAmount) },
    { label: 'Unemployment is for', old: s(current.unemployment_for), next: blank(next.unemploymentFor) },
    { label: 'Other income (monthly)', old: money(n(current.other_income_amount)), next: money(next.otherIncomeAmount) },
    { label: 'Other income is for', old: s(current.other_income_for), next: blank(next.otherIncomeFor) },
    { label: 'Good deed', edited: true, old: String(current.good_deed ?? ''), next: next.goodDeed },
    { label: 'Blended-family note', edited: true, old: String(current.parentage_note ?? ''), next: next.parentageNote },
  ]);
}

export function describeMemberChange(
  kind: 'added' | 'removed' | 'restored' | 'updated',
  current: Record<string, unknown> | null, next: MemberEdit | null,
): string[] {
  if (kind === 'added') return [`Person added: ${next!.name}`];
  const oldName = String(current!.name ?? '');
  if (kind === 'removed') return [`${oldName} removed`];
  if (kind === 'restored') return [`${oldName} restored`];
  const m = next!;
  const out: string[] = [];
  if (oldName !== m.name) out.push(`Person renamed from ${oldName} to ${m.name}`);
  const who = m.name;
  const s = (v: unknown) => blank(v == null ? '' : String(v));
  const rel = (v: string, other: string) => (v === '' ? 'blank' : relationshipLabel(v, other));
  const fields: [string, string, string][] = [
    ['relationship', rel(String(current!.relationship ?? ''), String(current!.relationship_other ?? '')), rel(m.relationship, m.relationshipOther ?? '')],
    ['sex', s(current!.sex), blank(m.sex)],
    ['age', s(current!.age), String(m.age)],
    ['permanently disabled', yesNo(current!.disabled === 1), yesNo(m.disabled === true)],
    ['lives here part of the time', yesNo(current!.part_time === 1), yesNo(m.partTime === true)],
    ['doll', dollLabel(String(current!.doll ?? '')), dollLabel(m.doll ?? '')],
    ['pants size', s(current!.pants), blank(m.pants)],
    ['shirt size', s(current!.shirt_top), blank(m.shirtTop)],
    ['underwear size', s(current!.underwear), blank(m.underwear)],
    ['socks size', s(current!.socks), blank(m.socks)],
    ['diapers size', s(current!.diapers), blank(m.diapers)],
    ['shoe size', s(current!.shoe), blank(m.shoe ?? '')],
    ['coat size', s(current!.coat), blank(m.coat ?? '')],
    ['gifts wanted', s(current!.gifts), blank(m.gifts)],
  ];
  for (const [label, oldV, newV] of fields) {
    if (oldV !== newV) out.push(`${who}: ${label} changed from ${oldV} to ${newV}`);
  }
  return out;
}

export function describeEmployerChange(
  kind: 'added' | 'removed' | 'restored' | 'updated',
  current: Record<string, unknown> | null, next: EmployerEdit | null,
): string[] {
  if (kind === 'added') return [`Job added: ${next!.workerName} at ${next!.employerName} (${money(next!.hourlyWage)} x ${next!.hoursPerWeek} hrs)`];
  const at = String(current!.employer_name ?? '');
  if (kind === 'removed') return [`Job at ${at} removed`];
  if (kind === 'restored') return [`Job at ${at} restored`];
  const e = next!;
  const out: string[] = [];
  const fields: [string, string, string][] = [
    ['employer', at, e.employerName],
    ['worker', String(current!.worker_name ?? ''), e.workerName],
    ['hourly wage', money(Number(current!.hourly_wage)), money(e.hourlyWage)],
    ['hours per week', String(current!.hours_per_week ?? ''), String(e.hoursPerWeek)],
  ];
  for (const [label, oldV, newV] of fields) {
    if (oldV !== newV) out.push(`Job at ${at}: ${label} changed from ${oldV} to ${newV}`);
  }
  return out;
}

export function describeCardsChanges(current: Record<string, unknown>, next: CardsGiven): string[] {
  const out: string[] = [];
  const mark = (label: string, oldOn: boolean, newOn: boolean, newAmount: number | null) => {
    if (oldOn === newOn) return;
    out.push(newOn ? `${label} marked given${newAmount != null ? ` (${money(newAmount)})` : ''}` : `${label} unmarked`);
  };
  mark('Thanksgiving card', current.thanksgiving_card === 1, next.thanksgivingCard, null);
  mark('Food card', current.food_card === 1, next.foodCard, next.foodCardAmount);
  mark('Gift card', current.gift_card === 1, next.giftCard, next.giftCardAmount);
  const amount = (label: string, oldV: number | null, newV: number | null, justMarked: boolean) => {
    if (justMarked || oldV === newV) return;
    out.push(`${label} amount changed from ${money(oldV)} to ${money(newV)}`);
  };
  amount('Food card', current.food_card_amount as number | null, next.foodCardAmount, current.food_card !== 1 && next.foodCard);
  amount('Gift card', current.gift_card_amount as number | null, next.giftCardAmount, current.gift_card !== 1 && next.giftCard);
  return out;
}

export function describeBagsChange(oldBags: number | null, newBags: number | null): string | null {
  if (oldBags === newBags) return null;
  if (newBags == null) return 'Bag count cleared';
  if (oldBags == null) return `Bag count set to ${newBags}`;
  return `Bag count changed from ${oldBags} to ${newBags}`;
}

export function describePuChange(oldPu: number | null, newPu: number | null): string | null {
  if (oldPu === newPu) return null;
  if (newPu == null) return 'Pickup number cleared';
  if (oldPu == null) return `Pickup number set to ${newPu}`;
  return `Pickup number changed from ${oldPu} to ${newPu}`;
}

export function describeDecision(
  kind: 'approved' | 'denied', assignedPu: number | null | undefined, mail: 'sent' | 'failed' | 'none',
): string {
  let base = kind === 'approved' ? 'Approved' : 'Denied';
  if (kind === 'approved' && assignedPu != null) base = `Approved; pickup number ${assignedPu} assigned`;
  if (kind === 'approved' && assignedPu === null) base = 'Approved (no number free in the block)';
  if (mail === 'sent') return `${base} — email sent`;
  if (mail === 'failed') return `${base} — email could not be sent`;
  return base;
}
