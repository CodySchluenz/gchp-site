// The household relationship options, shared by the applicant form, validation,
// the admin views, and the export. Values are stored in household_members.relationship.
export const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Myself (head of household)' },
  { value: 'other_parent', label: 'The other parent' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'court', label: 'Court-appointed (foster child or guardianship)' },
  { value: 'not_related', label: 'Not related (boyfriend, roommate, other adult)' },
  { value: 'other', label: 'Other' },
] as const;

export const RELATIONSHIP_VALUES: Set<string> = new Set(RELATIONSHIP_OPTIONS.map((o) => o.value));

// Adults who are not part of the eligible immediate family. Drives the admin
// "please verify" review tag only — it never blocks or denies anything.
export const NON_FAMILY_RELATIONSHIPS = new Set(['not_related']);

// Human label for a stored relationship value. Falls back to the raw value so
// legacy/imported rows (blank or free-text) still render sensibly.
export function relationshipLabel(value: string, other = ''): string {
  if (value === 'other') return other.trim() || 'Other';
  const found = RELATIONSHIP_OPTIONS.find((o) => o.value === value);
  if (found) return found.label;
  return value.trim() || '—';
}
