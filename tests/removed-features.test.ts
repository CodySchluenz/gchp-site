import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Sherlyn's 2026-07-23 decision: NO automated eligibility of any kind.
// This scan keeps removed features from creeping back into shipped code.
const FORBIDDEN = ['income-check', 'incomeCheck', 'IncomeLimits', 'getIncomeLimits', 'quickIncomeCheck', 'mayNotBeEligible'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|astro|js|mjs)$/.test(name) ? [p] : [];
  });
}

describe('removed features stay removed', () => {
  it('no eligibility-check tokens in src/ or public/', () => {
    const hits: string[] = [];
    for (const file of [...walk('src'), ...walk('public')]) {
      const text = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        if (text.includes(token)) hits.push(`${file}: ${token}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
