// Writes a sample of the operator's Excel download using the real xlsx writer,
// for eyeballing in Excel after export changes. Headers/row shape mirror
// src/lib/export-columns.ts (which can't be imported here — its extensionless
// relative imports don't resolve under node --experimental-strip-types).
// Run with: node --experimental-strip-types scripts/make-sample-xlsx.mjs [out.xlsx]
import { writeFileSync } from 'node:fs';
import { buildXlsxWorkbook } from '../src/lib/xlsx.ts';

const headers = [
  'tNo', '2026 Applicant', 'Address', 'Special Gift', 'adopted', 'Adopted by', 'Thanksgiving',
  'Food Card/Cert.', 'Amount', 'Gift Cards', 'GC Amount', 'NO. in HH',
];
const widths = [];
widths[headers.indexOf('Special Gift')] = 22;

// Two town tabs, like the "All towns" download produces.
const sheets = [
  {
    name: 'Fennimore', headers, widthOverrides: widths,
    rows: [[803, 'Jane Smith', '123 Winterberry Lane, Fennimore', '', 'yes', 'Platteville Kiwanis', 'yes', 'yes', 50, '', '', 3]],
  },
  {
    name: 'Lancaster', headers, widthOverrides: widths,
    rows: [[104, 'Bob Verylongname-Example', '1486 Industrial Park Rd, Lancaster', '', '', '', '', '', '', 'yes', 25, 5]],
  },
];

const out = process.argv[2] ?? 'sample-export.xlsx';
writeFileSync(out, buildXlsxWorkbook(sheets));
console.log(`wrote ${out}`);
