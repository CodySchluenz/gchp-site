// Display formatting for Grant County (America/Chicago). Timestamps are
// STORED as UTC ISO strings everywhere; only display converts. Never format
// with the server's local zone — Workers run in UTC, which is exactly the
// day-shift bug this module fixes.
const CENTRAL = 'America/Chicago';

export function centralDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { timeZone: CENTRAL, month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function centralDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: CENTRAL, month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(/ /g, ' ');
}

// Today's date on the Central clock, right now (or at the given instant), as
// YYYY-MM-DD (en-CA gives ISO date order). Shared by apply.astro (via
// centralYear below) and admin/applications/new.astro (which needs the full
// date, to default the "date received" field on a paper-entry form) so the
// online and paper paths derive "today" from the exact same clock.
export function centralToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CENTRAL }).format(now);
}

// The calendar year on the Central clock, right now (or at the given instant).
// Workers run in UTC, so a plain `new Date().getFullYear()` reads Jan 1 up to
// six hours before Central actually reaches it -- this is the fix for that.
export function centralYear(now: Date = new Date()): number {
  return Number(centralToday(now).slice(0, 4));
}
