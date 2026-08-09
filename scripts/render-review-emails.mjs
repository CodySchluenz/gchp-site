// Regenerates review-emails.json from the site's REAL email code, so the
// "What Families See" review pack always shows exactly what goes out.
// Run with: node --experimental-strip-types scripts/render-review-emails.mjs
// (strip-types lets Node import the TypeScript render module directly).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderApplicationReceivedEmail, renderApprovedEmail, renderElderlyApprovedEmail,
  renderDeniedEmail, renderAdoptedEmail,
} from '../src/lib/email/render.ts';

const here = dirname(fileURLToPath(import.meta.url));
const emails = {
  received: renderApplicationReceivedEmail('Merry'),
  approvedFamily: renderApprovedEmail('Merry'),
  approvedElderly: renderElderlyApprovedEmail('Edna'),
  denied: renderDeniedEmail('Merry'),
  adopted: renderAdoptedEmail('Merry'),
};
writeFileSync(join(here, 'review-emails.json'), JSON.stringify(emails));
console.log('review-emails.json written from src/lib/email/render.ts');
