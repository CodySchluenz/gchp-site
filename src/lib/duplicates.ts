// The duplicate-application matcher: exact match on normalized last name +
// address, deliberately NOT fuzzy (Smith vs Smyth stays unmatched — a wrong
// nudge about a family costs trust). Computed at render time, never stored,
// so correcting a typo'd address clears the nudge immediately.
export function duplicateKey(lastName: string, address: string): string | null {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const l = norm(lastName);
  const a = norm(address);
  // Blank guard: paper entries may leave the address empty — two blanks are
  // not evidence of anything, so they never match.
  if (l === '' || a === '') return null;
  return `${l}|${a}`;
}

export function findDuplicateIds(rows: { id: number; last_name: string; address: string }[]): Set<number> {
  const byKey = new Map<string, number[]>();
  for (const row of rows) {
    const key = duplicateKey(row.last_name, row.address);
    if (key === null) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row.id);
  }
  const out = new Set<number>();
  for (const ids of byKey.values()) {
    if (ids.length > 1) for (const id of ids) out.add(id);
  }
  return out;
}
