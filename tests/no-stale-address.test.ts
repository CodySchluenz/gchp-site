import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';

// The mailing address was corrected 235 -> 245 W. Elm St. (owner-confirmed).
// This scans the seed migration and every app source file so the stale
// number can never quietly creep back in. Paths are relative to the repo
// root, same as tests/helpers/d1.ts, since vitest's cwd is the project root.
const STALE = '235 W. Elm';

function walk(dir: string, matches: (name: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) {
      walk(full, matches, out);
    } else if (matches(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('no stale "235 W. Elm" address', () => {
  it('does not appear anywhere in migrations/', () => {
    const files = walk('migrations', (n) => n.endsWith('.sql'));
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(STALE));
    expect(offenders).toEqual([]);
  });

  it('does not appear anywhere in src/ (.ts/.astro/.sql)', () => {
    const files = walk('src', (n) => /\.(ts|astro|sql)$/.test(n));
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(STALE));
    expect(offenders).toEqual([]);
  });
});
