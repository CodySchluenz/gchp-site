import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';

// Binding note from Plan 1's final review: assert that D1 actually enforces
// the REFERENCES clauses before any code relies on them.
describe('D1 schema integrity', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    ({ db, dispose } = await getTestDb());
  });
  afterAll(async () => {
    await dispose();
  });

  it('rejects a household member pointing at a missing application', async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO household_members (application_id, position, name, relationship, sex, age) VALUES (99999, 1, 'x', 'self', 'F', 30)",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects an employer pointing at a missing application', async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO employers (application_id, employer_name, worker_name, hourly_wage, hours_per_week) VALUES (99999, 'x', 'x', 10, 40)",
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects an application pointing at a missing city', async () => {
    await expect(
      db
        .prepare(
          `INSERT INTO applications (season_year, submitted_at, first_name, last_name, address, city_id, phone, email)
           VALUES (2026, '2026-10-01T00:00:00Z', 'A', 'B', '1 Elm', 424242, '555', 'a@b.co')`,
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('accepts a valid application row against the seeded city', async () => {
    const res = await db
      .prepare(
        `INSERT INTO applications (season_year, submitted_at, first_name, last_name, address, city_id, phone, email)
         VALUES (2026, '2026-10-01T00:00:00Z', 'A', 'B', '1 Elm', 13, '555', 'a@b.co')`,
      )
      .run();
    expect(res.meta.last_row_id).toBeGreaterThan(0);
  });

  it('accepts a member row using the new relationship/disability/size columns', async () => {
    const app = await db
      .prepare(
        `INSERT INTO applications (season_year, submitted_at, first_name, last_name, address, city_id, phone, email)
         VALUES (2026, '2026-10-01T00:00:00Z', 'A', 'B', '1 Elm', 13, '555', 'a@b.co')`,
      )
      .run();
    const appId = app.meta.last_row_id;
    const res = await db
      .prepare(
        `INSERT INTO household_members
           (application_id, position, name, relationship, relationship_other, sex, age, disabled, part_time, shoe, coat)
         VALUES (?, 1, 'Kid', 'not_related', '', 'M', 30, 1, 1, '10', 'L')`,
      )
      .bind(appId)
      .run();
    expect(res.meta.last_row_id).toBeGreaterThan(0);
    const back = await db
      .prepare('SELECT disabled, part_time, shoe, coat, relationship FROM household_members WHERE application_id = ?')
      .bind(appId)
      .first<{ disabled: number; part_time: number; shoe: string; coat: string; relationship: string }>();
    expect(back).toMatchObject({ disabled: 1, part_time: 1, shoe: '10', coat: 'L', relationship: 'not_related' });
  });

  it('0005 adds cities.block_base and applications.straggler', async () => {
    const city = await db
      .prepare('SELECT block_base FROM cities WHERE id = 13')
      .first<{ block_base: number }>();
    expect(city?.block_base).toBe(800); // harness seeds Lancaster with its base
    const cols = await db.prepare("SELECT name FROM pragma_table_info('applications')").all<{ name: string }>();
    expect(cols.results.map((c) => c.name)).toContain('straggler');
  });

  it('0006 adds applications.decided_at', async () => {
    const cols = await db.prepare("SELECT name FROM pragma_table_info('applications')").all<{ name: string }>();
    expect(cols.results.map((c) => c.name)).toContain('decided_at');
  });

  it('0007 adds applications.source with empty default', async () => {
    const cols = await db.prepare("SELECT name FROM pragma_table_info('applications')").all<{ name: string }>();
    expect(cols.results.map((c) => c.name)).toContain('source');
  });

  it('0008 adds cities.pickup_day_id and settings.straggler_pickup_day_id', async () => {
    const cityCols = await db.prepare("SELECT name FROM pragma_table_info('cities')").all<{ name: string }>();
    expect(cityCols.results.map((c) => c.name)).toContain('pickup_day_id');
    const settingsCols = await db.prepare("SELECT name FROM pragma_table_info('settings')").all<{ name: string }>();
    expect(settingsCols.results.map((c) => c.name)).toContain('straggler_pickup_day_id');
  });

  it('season revisions: income_limits is gone; doll and card columns exist', async () => {
    const t = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'income_limits'").first();
    expect(t).toBeNull();
    const m = await db.prepare('PRAGMA table_info(household_members)').all<{ name: string }>();
    expect(m.results.map((c) => c.name)).toContain('doll');
    const a = await db.prepare('PRAGMA table_info(applications)').all<{ name: string }>();
    const names = a.results.map((c) => c.name);
    for (const col of ['thanksgiving_card', 'food_card', 'food_card_amount', 'gift_card', 'gift_card_amount']) {
      expect(names).toContain(col);
    }
    expect(names).toContain('may_not_be_eligible'); // deliberately inert, still present
  });
});
