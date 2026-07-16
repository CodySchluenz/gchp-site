import { describe, it, expect } from 'vitest';
import {
  RELATIONSHIP_OPTIONS, RELATIONSHIP_VALUES, NON_FAMILY_RELATIONSHIPS, relationshipLabel,
} from '../src/lib/relationships';

describe('relationships lib', () => {
  it('exposes the eight canonical values', () => {
    expect([...RELATIONSHIP_VALUES]).toEqual([
      'self', 'other_parent', 'son', 'daughter', 'grandchild', 'court', 'not_related', 'other',
    ]);
    expect(RELATIONSHIP_OPTIONS).toHaveLength(8);
  });
  it('maps a code to its label', () => {
    expect(relationshipLabel('son')).toBe('Son');
    expect(relationshipLabel('not_related')).toContain('Not related');
  });
  it('uses the other text when value is other', () => {
    expect(relationshipLabel('other', 'Niece')).toBe('Niece');
    expect(relationshipLabel('other', '')).toBe('Other');
  });
  it('falls back to raw value for legacy data, and dash for blank', () => {
    expect(relationshipLabel('grandma')).toBe('grandma');
    expect(relationshipLabel('')).toBe('—');
  });
  it('flags only not_related as non-family', () => {
    expect(NON_FAMILY_RELATIONSHIPS.has('not_related')).toBe(true);
    expect(NON_FAMILY_RELATIONSHIPS.has('son')).toBe(false);
  });
});
