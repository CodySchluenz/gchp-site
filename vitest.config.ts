import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'scripts/migrate/**/*.test.mjs'],
    // The db-*.test.ts suites run against a real local Cloudflare D1 via wrangler's
    // getPlatformProxy. Spinning up the proxy and applying migrations is slow, and
    // several files running in parallel contend for it, so the 5000ms default timeout
    // flakes under load even though every test passes in isolation. 20s is the same
    // headroom the slowest suites already request per-test; set it globally so a normal
    // `npm run test` is reliably green with no per-file tuning.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
