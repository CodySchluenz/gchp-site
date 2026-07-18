// Income check: does the operator's 200%-of-poverty arithmetic and shows its
// work. Decision support ONLY (owner decision, 2026-07-18 spec): the result is
// an observation about REPORTED income, never an eligibility decision, and it
// is never stored — always recomputed from the application and that season's
// limits (income_limits table, edited at /admin/income-limits).
//
// Defaults awaiting Sherlyn's confirmation (see the 2026-07-18 spec):
//   1. FoodShare is NOT counted (food aid, not income) — shown as a
//      not-counted line so she always sees it.
//   2. Household size counts every listed member, including part-time children.
//   3. Wages annualize x52 weeks; monthly benefits x12; weekly unemployment x52.
//
// The x52 wage annualization is duplicated in two SQL subqueries in src/lib/db.ts
// (listApplications and listApplicationsForExport) — keep them in sync if this
// annualization ever changes.

export type IncomeLimits = {
  sizes: number[]; // index 0 = household of 1 ... index 7 = household of 8
  extraPerson: number; // add this much for each person above 8
};

export type IncomeLine = { label: string; yearly: number };

export type IncomeCheck = {
  counted: IncomeLine[]; // these sum to totalYearly
  notCounted: IncomeLine[]; // shown greyed, never summed (FoodShare)
  totalYearly: number;
  householdSize: number;
  limit: number | null; // null = no limits row for this season
  overLimit: boolean | null; // null when limit is null; else strictly greater
};

export type BenefitAmounts = {
  foodShareAmount: number | null;
  socialSecurityAmount: number | null;
  ssiAmount: number | null;
  childSupportAmount: number | null;
  unemploymentWeeklyAmount: number | null;
  otherIncomeAmount: number | null;
};

export type EmployerLine = {
  employerName: string;
  workerName: string;
  hourlyWage: number;
  hoursPerWeek: number;
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export function limitForSize(size: number, limits: IncomeLimits | null): number | null {
  if (!limits) return null;
  const n = Math.max(1, Math.floor(size)); // a household is always at least the applicant
  if (n <= 8) return limits.sizes[n - 1] ?? null;
  return limits.sizes[7] + limits.extraPerson * (n - 8);
}

function benefitLines(b: BenefitAmounts): { counted: IncomeLine[]; notCounted: IncomeLine[] } {
  const counted: IncomeLine[] = [];
  const notCounted: IncomeLine[] = [];
  const monthly: [string, number | null][] = [
    ['Social Security', b.socialSecurityAmount],
    ['SSI', b.ssiAmount],
    ['Child support', b.childSupportAmount],
    ['Other income', b.otherIncomeAmount],
  ];
  for (const [label, amt] of monthly) {
    if (amt != null) {
      counted.push({ label: `${label}: ${money(amt)}/month x 12 = ${money(amt * 12)}`, yearly: Math.round(amt * 12) });
    }
  }
  if (b.unemploymentWeeklyAmount != null) {
    const a = b.unemploymentWeeklyAmount;
    counted.push({ label: `Unemployment: ${money(a)}/week x 52 = ${money(a * 52)}`, yearly: Math.round(a * 52) });
  }
  if (b.foodShareAmount != null) {
    notCounted.push({
      label: `FoodShare: ${money(b.foodShareAmount)}/month — not counted (food aid, not income)`,
      yearly: 0,
    });
  }
  return { counted, notCounted };
}

export function checkIncome(
  app: { employers: EmployerLine[]; benefits: BenefitAmounts; householdSize: number },
  limits: IncomeLimits | null,
): IncomeCheck {
  const jobLines: IncomeLine[] = app.employers.map((e) => ({
    label: `Job — ${e.employerName} (${e.workerName}): $${e.hourlyWage.toFixed(2)} x ${e.hoursPerWeek} hrs x 52 = ${money(e.hourlyWage * e.hoursPerWeek * 52)}`,
    yearly: Math.round(e.hourlyWage * e.hoursPerWeek * 52), // display only — per-line rounding
  }));
  const b = benefitLines(app.benefits);
  const counted = [...jobLines, ...b.counted];
  // Employment's contribution to the total is the RAW sum rounded once (not the
  // sum of each already-rounded job line), matching quickIncomeCheck's SQL input
  // (SUM(hourly_wage * hours_per_week * 52)) exactly. With >=1 jobs and fractional
  // annualized values, round-then-sum can differ from sum-then-round by $1, which
  // would make the list badge disagree with this detail box for the same
  // application — see tests/income-check.test.ts for a worked example.
  const rawEmployment = app.employers.reduce((s, e) => s + e.hourlyWage * e.hoursPerWeek * 52, 0);
  const totalYearly = Math.round(rawEmployment) + b.counted.reduce((sum, l) => sum + l.yearly, 0);
  const limit = limitForSize(app.householdSize, limits);
  return {
    counted,
    notCounted: b.notCounted,
    totalYearly,
    householdSize: app.householdSize,
    limit,
    overLimit: limit === null ? null : totalYearly > limit,
  };
}

// For list rows and the export, where SQL pre-sums employment
// (SUM(hourly_wage * hours_per_week * 52)) and no line labels are needed.
export function quickIncomeCheck(
  employmentYearly: number,
  benefits: BenefitAmounts,
  householdSize: number,
  limits: IncomeLimits | null,
): { totalYearly: number; limit: number | null; overLimit: boolean | null } {
  const b = benefitLines(benefits);
  const totalYearly = Math.round(employmentYearly) + b.counted.reduce((sum, l) => sum + l.yearly, 0);
  const limit = limitForSize(householdSize, limits);
  return { totalYearly, limit, overLimit: limit === null ? null : totalYearly > limit };
}

// The exact strings the Excel export shows in its "Income check" column.
// Pinned by tests — the operator's export must never silently change meaning.
export function incomeFlagLabel(overLimit: boolean | null): string {
  return overLimit === null ? 'no limits set' : overLimit ? 'over limit' : '';
}
