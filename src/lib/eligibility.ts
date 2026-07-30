// The form NEVER decides or flags eligibility (owner decisions 2026-07-12
// and 2026-07-23): Sherlyn verifies every application by hand. This helper
// only suggests the household TYPE, which routes elderly/disabled
// households to the mailed 2500 pickup block — workflow, not eligibility.

type HouseholdShape = { permanentlyDisabled: boolean; members: { age: number }[] };

export function suggestHouseholdType(app: HouseholdShape): 'family' | 'elderly' | 'disabled' {
  // Sherlyn's rule (2026-07-30): a home with children under 18 is a FAMILY
  // household — regular gifts and pickup — even when a parent or another
  // member is permanently disabled. Cards go to elderly/disabled households
  // without children only.
  if (app.members.some((m) => m.age < 18)) return 'family';
  if (app.permanentlyDisabled) return 'disabled';
  if ((app.members[0]?.age ?? 0) >= 65) return 'elderly';
  return 'family';
}
