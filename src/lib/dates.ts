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
