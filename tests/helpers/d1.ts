import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';

type Env = { DB: D1Database };

// Fresh, isolated local D1 per call: schema from the real migration file,
// minimal seed rows (one city for FK targets, the settings row).
export async function getTestDb(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<Env>({ persist: false });
  const db = proxy.env.DB;
  for (const file of ['migrations/0001_init.sql', 'migrations/0003_relationships.sql', 'migrations/0004_income_limits.sql', 'migrations/0005_town_blocks.sql', 'migrations/0006_decided_at.sql', 'migrations/0007_source.sql', 'migrations/0008_town_pickup_days.sql', 'migrations/0009_soft_delete_members.sql', 'migrations/0010_dolls_and_cards.sql', 'migrations/0011_drop_income_limits.sql', 'migrations/0012_application_history.sql', 'migrations/0013_doll_non_white.sql', 'migrations/0014_packing_note.sql', 'migrations/0015_adoptions.sql', 'migrations/0016_elderly_pdf.sql']) {
    const sql = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l: string) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql.split(';').map((s: string) => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run();
    }
  }
  await db.prepare("INSERT INTO cities (id, name, zip, block_base) VALUES (13, 'Lancaster', '53813', 800)").run();
  await db.prepare('INSERT INTO settings (id, applications_open) VALUES (1, 1)').run();
  return { db, dispose: () => proxy.dispose() };
}
