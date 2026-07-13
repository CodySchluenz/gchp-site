// Minimal RFC-4180 CSV with a UTF-8 BOM so Excel opens accented names correctly.
function cell(v: string | number | null): string {
  if (v === null) return '';
  if (typeof v === 'number') return String(v);
  // Neutralize spreadsheet formula auto-detection: a leading =, +, -, @ (or
  // tab/CR) makes Excel/Sheets treat the cell as a formula. Prefixing with an
  // apostrophe forces it to plain text. Applies to free-text applicant fields.
  let s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
