import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseRows } from './parse.mjs';
import { transformDonors } from './transform-donors.mjs';
import { transformApplicants } from './transform-applicants.mjs';
import { generateImportSql } from './sql.mjs';

// Pure pipeline: dump text -> { sql, report }. Exported so tests can exercise it.
export function buildImport(dumpText) {
  const { donors, flagged: donorFlags } = transformDonors(parseRows(dumpText, 'donor'));
  const { applications, members, employers, flagged: appFlags } = transformApplicants({
    applicants: parseRows(dumpText, 'applicants'),
    appEmp: parseRows(dumpText, 'appEmp'),
    benefits: parseRows(dumpText, 'benefits'),
    children: parseRows(dumpText, 'children'),
    goodDeed: parseRows(dumpText, 'goodDeed'),
  });
  const sql = generateImportSql({ donors, applications, members, employers });
  const report = {
    counts: { donors: donors.length, applications: applications.length, members: members.length, employers: employers.length },
    donorFlags,
    appFlags,
  };
  return { sql, report };
}

function printReport(report) {
  const c = report.counts;
  console.log('Migration report');
  console.log(`  donors:       ${c.donors}`);
  console.log(`  applications: ${c.applications}`);
  console.log(`  members:      ${c.members}`);
  console.log(`  employers:    ${c.employers}`);
  if (report.donorFlags.length) {
    console.log(`\n  Likely-junk donors to review/delete in the admin (${report.donorFlags.length}):`);
    for (const n of report.donorFlags) console.log(`    - ${n}`);
  }
  const synth = report.appFlags.filter((f) => f.type === 'synth-member').map((f) => f.appID);
  const w2 = report.appFlags.filter((f) => f.type === 'w2-fold').map((f) => f.appID);
  if (synth.length) console.log(`\n  Applications given a placeholder "self" member (no children in old data): ${synth.join(', ')}`);
  if (w2.length) console.log(`  Applications whose W-2 amount was folded into "other income": ${w2.join(', ')}`);
}

function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('Usage: node scripts/migrate/run.mjs <path-to-dump.sql>');
    process.exit(1);
  }
  const dumpText = readFileSync(dumpPath, 'utf8');
  const { sql, report } = buildImport(dumpText);
  writeFileSync('import.sql', sql);
  printReport(report);
  console.log('\nWrote import.sql — review it, then load with: wrangler d1 execute <DB> --file=import.sql --remote');
}

// Run main only when invoked directly (not when imported by a test).
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) main();
