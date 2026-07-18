import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';

type Env = { DB: D1Database };

// Fresh, isolated local D1 per call: schema from the real migration file,
// minimal seed rows (one city for FK targets, the settings row).
export async function getTestDb(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<Env>({ persist: false });
  const db = proxy.env.DB;
  for (const file of ['migrations/0001_init.sql', 'migrations/0003_relationships.sql', 'migrations/0004_income_limits.sql']) {
    const sql = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l: string) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql.split(';').map((s: string) => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run();
    }
  }
  await db.prepare("INSERT INTO cities (id, name, zip) VALUES (13, 'Lancaster', '53813')").run();
  await db.prepare('INSERT INTO settings (id, applications_open) VALUES (1, 1)').run();
  return { db, dispose: () => proxy.dispose() };
}
