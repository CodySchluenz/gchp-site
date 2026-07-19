# Submission & Decision Times — Design

Date: 2026-07-18. Status: approved by owner in brainstorming.

## Why

The operator (and the county's yearly audit) benefit from knowing when an
application was submitted and when it was approved or denied. The submission
timestamp is already stored in full (`applications.submitted_at`, UTC ISO) but
only ever displayed as a date; decision time is not recorded at all.

Building this also fixes an existing bug: dates are displayed by slicing the
UTC ISO string (`iso.slice(0, 10)`), so anything submitted after ~6-7 PM
Central files under the NEXT day's date in the admin list, the Excel export,
and the Messages page. Grant County is America/Chicago; all display must
convert.

## Owner decisions (2026-07-18)

- Timestamp **both approvals and denials**: one `decided_at` column set by
  `setApplicationStatus`. Completes the audit trail at the same cost as
  approval-only.
- Applications decided before this feature show nothing (no backfill guessing).
- List stays date-only (scanning); detail and export carry full date + time.

## Architecture

### Migration `0006_decided_at.sql`

```sql
ALTER TABLE applications ADD COLUMN decided_at TEXT;
```

Nullable on purpose. Test harness (`tests/helpers/d1.ts`) applies `0006` after
`0005`. `setApplicationStatus(db, id, status)` becomes a single UPDATE:
`SET status = ?, decided_at = ?` with the current UTC ISO string.

### Shared formatter — `src/lib/dates.ts` (pure, TDD)

```ts
export function centralDate(iso: string): string;      // "12/03/2026"
export function centralDateTime(iso: string): string;  // "12/03/2026, 7:42 PM"
```

Implemented with `toLocaleString('en-US', { timeZone: 'America/Chicago', ... })`
(Workers ships full ICU; DST — CST/CDT — handled by the platform). Empty or
null-ish input returns `''`.

### Display changes (all admin-only)

- **Detail page** (`[id].astro`): "Applied: {centralDateTime(submitted_at)}"
  line in the Household section; in the Decision section, when status is not
  `new` and `decided_at` is present: "Approved on {centralDateTime}" /
  "Denied on {centralDateTime}".
- **Applications list** (`index.astro`): `fmtDate` replaced by `centralDate`
  (day-shift bug fixed; stays date-only).
- **Excel export** (`export.xlsx.ts`): "Applied" column becomes
  `centralDateTime` (date + time); new column **"Decided"** immediately after
  "Status", `centralDateTime(decided_at)` or `''`. `ExportRow` gains
  `decided_at: string | null`.
- **Messages page** (`messages/index.astro`): same-bug fix — its local
  `fmtDate` slice replaced by `centralDate` (targeted improvement, same class
  of defect, code being touched anyway).

## Testing

- `tests/dates.test.ts`: a UTC evening timestamp (e.g. `2026-12-04T02:30:00Z`)
  renders as the previous Central day (12/03/2026, 8:30 PM CST); a July
  timestamp proves CDT (UTC-5) vs December CST (UTC-6); empty input → `''`.
- D1: `setApplicationStatus` sets `decided_at` on approve AND deny (non-null,
  ISO-parseable); newly inserted applications have `decided_at` NULL.
- Export: "Decided" header present after "Status"; value formatted for a
  decided fixture and `''` for an undecided one.
- Screens via `npm run build` + suite green (house pattern).

## Out of scope

- Backfilling `decided_at` for already-decided rows.
- Any applicant-facing change; any workflow/status change.
- Storing anything in local time (storage stays UTC ISO; only display converts).
