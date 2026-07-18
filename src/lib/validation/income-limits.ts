// Forgiving parsing for the operator's yearly income-limit form. She copies
// numbers from the printed 200%-of-poverty chart, so accept "$31,920",
// "31 920", or "31920" — whole positive dollars only. Errors are kind,
// field-specific, and never wipe what she typed (the page re-renders values).
import type { IncomeLimits } from '../income-check';

export const LIMIT_FIELDS = [
  'size_1', 'size_2', 'size_3', 'size_4', 'size_5', 'size_6', 'size_7', 'size_8', 'extra_person',
] as const;

export function validateIncomeLimits(
  input: Record<string, string>,
): { ok: true; limits: IncomeLimits } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const parsed: Record<string, number> = {};
  for (const f of LIMIT_FIELDS) {
    const raw = (input[f] ?? '').replace(/[$,\s]/g, '');
    if (raw === '') {
      errors[f] = 'Please fill in this amount.';
      continue;
    }
    if (!/^\d+$/.test(raw)) {
      errors[f] = 'Please enter a whole dollar amount, like 31920.';
      continue;
    }
    const n = Number(raw);
    if (n <= 0 || n > 10_000_000) {
      errors[f] = "That number doesn't look right — please double-check the chart.";
      continue;
    }
    parsed[f] = n;
  }
  // Typo guard: the chart always goes up with household size.
  if (Object.keys(errors).length === 0) {
    for (let i = 2; i <= 8; i++) {
      if (parsed[`size_${i}`] < parsed[`size_${i - 1}`]) {
        errors[`size_${i}`] =
          `These numbers usually go up as the household gets bigger — please double-check household of ${i}.`;
      }
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    limits: {
      sizes: LIMIT_FIELDS.slice(0, 8).map((f) => parsed[f]),
      extraPerson: parsed.extra_person,
    },
  };
}
