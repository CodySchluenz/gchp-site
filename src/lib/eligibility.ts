// Eligibility is NEVER enforced by the form (owner decision 2026-07-12):
// the flag only marks applications for the admin's human review.

type HouseholdShape = { permanentlyDisabled: boolean; members: { age: number }[] };

export function mayNotBeEligible(app: HouseholdShape): boolean {
  const hasChild = app.members.some((m) => m.age < 18);
  const headIsSenior = (app.members[0]?.age ?? 0) >= 65;
  return !hasChild && !headIsSenior && !app.permanentlyDisabled;
}

export function suggestHouseholdType(app: HouseholdShape): 'family' | 'elderly' | 'disabled' {
  if (app.permanentlyDisabled) return 'disabled';
  if ((app.members[0]?.age ?? 0) >= 65) return 'elderly';
  return 'family';
}
