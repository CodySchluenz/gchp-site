import type { CleanApplication } from './validation/application';

export type ContentBlock = { id: number; title: string; subtitle: string; body: string };

export async function listContentBlocks(db: D1Database): Promise<ContentBlock[]> {
  const { results } = await db
    .prepare(
      'SELECT id, title, subtitle, body FROM content_blocks WHERE deleted_at IS NULL ORDER BY sort_order, id',
    )
    .all<ContentBlock>();
  return results;
}

export type Settings = {
  applications_open: number;
  pickup_title: string;
  pickup_intro: string;
  pickup_footer: string;
  pdf_uploaded_at: string | null;
};

export async function getSettings(db: D1Database): Promise<Settings> {
  const row = await db
    .prepare(
      'SELECT applications_open, pickup_title, pickup_intro, pickup_footer, pdf_uploaded_at FROM settings WHERE id = 1',
    )
    .first<Settings>();
  if (!row) throw new Error('settings row missing — run migrations');
  return row;
}

export type PickupDay = { id: number; date_text: string; description: string };

export async function listPickupDays(db: D1Database): Promise<PickupDay[]> {
  const { results } = await db
    .prepare(
      'SELECT id, date_text, description FROM pickup_days WHERE deleted_at IS NULL ORDER BY sort_order, id',
    )
    .all<PickupDay>();
  return results;
}

export async function insertContactMessage(
  db: D1Database,
  v: { name: string; email: string; message: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO contact_messages (received_at, name, email, message) VALUES (?, ?, ?, ?)')
    .bind(new Date().toISOString(), v.name, v.email, v.message)
    .run();
}

export type City = { id: number; name: string };

export async function listCities(db: D1Database): Promise<City[]> {
  const { results } = await db.prepare('SELECT id, name FROM cities ORDER BY name').all<City>();
  return results;
}

export type NewApplication = CleanApplication & {
  seasonYear: number;
  submittedAt: string;
  mayNotBeEligible: boolean;
  householdType: 'family' | 'elderly' | 'disabled';
};

export async function insertApplication(db: D1Database, app: NewApplication): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO applications (
         season_year, submitted_at, first_name, last_name, address, city_id, phone, email,
         diabetic, share_with_sponsor, permanently_disabled, bed_choice, bed_size,
         full_time_residence_confirmed, years_received_help, adopted_last_year, household_type,
         no_employment_confirmed,
         food_share_amount,
         social_security_amount, social_security_for,
         ssi_amount, ssi_for,
         child_support_amount, child_support_for,
         unemployment_weekly_amount, unemployment_for,
         other_income_amount, other_income_for,
         good_deed, may_not_be_eligible
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      app.seasonYear, app.submittedAt, app.firstName, app.lastName, app.address, app.cityId,
      app.phone, app.email,
      app.diabetic ? 1 : 0, app.shareWithSponsor ? 1 : 0, app.permanentlyDisabled ? 1 : 0,
      app.bedChoice, app.bedSize,
      app.fullTimeResidenceConfirmed ? 1 : 0, app.yearsReceivedHelp, app.adoptedLastYear ? 1 : 0,
      app.householdType,
      app.noEmploymentConfirmed ? 1 : 0,
      app.benefits.foodShareAmount,
      app.benefits.socialSecurityAmount, app.benefits.socialSecurityFor,
      app.benefits.ssiAmount, app.benefits.ssiFor,
      app.benefits.childSupportAmount, app.benefits.childSupportFor,
      app.benefits.unemploymentWeeklyAmount, app.benefits.unemploymentFor,
      app.benefits.otherIncomeAmount, app.benefits.otherIncomeFor,
      app.goodDeed, app.mayNotBeEligible ? 1 : 0,
    )
    .run();

  const appId = res.meta.last_row_id as number;

  const statements = [
    ...app.members.map((m, i) =>
      db
        .prepare(
          `INSERT INTO household_members
             (application_id, position, name, relationship, sex, age, pants, shirt_top, underwear, socks, diapers, gifts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(appId, i + 1, m.name, m.relationship, m.sex, m.age, m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.gifts),
    ),
    ...app.employers.map((e) =>
      db
        .prepare(
          `INSERT INTO employers (application_id, employer_name, worker_name, hourly_wage, hours_per_week)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(appId, e.employerName, e.workerName, e.hourlyWage, e.hoursPerWeek),
    ),
  ];
  if (statements.length > 0) {
    try {
      await db.batch(statements);
    } catch (e) {
      // Never leave an orphaned application (a "family" with no people):
      // children haven't been written, so this delete is FK-safe.
      await db.prepare('DELETE FROM applications WHERE id = ?').bind(appId).run();
      throw e;
    }
  }

  return appId;
}

export type ApplicationListRow = {
  id: number;
  first_name: string;
  last_name: string;
  city_name: string;
  submitted_at: string;
  status: string;
  may_not_be_eligible: number;
  pu_number: number | null;
};

export async function listApplications(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
  search: string,
): Promise<ApplicationListRow[]> {
  const like = `%${search.trim().toLowerCase()}%`;
  const cols = `a.id, a.first_name, a.last_name, c.name AS city_name, a.submitted_at,
                a.status, a.may_not_be_eligible, a.pu_number`;
  // The name filter is a no-op when the search box is empty (like === '%%').
  const nameFilter = `(? = '%%' OR lower(a.first_name) LIKE ? OR lower(a.last_name) LIKE ?)`;
  const order = `ORDER BY a.submitted_at DESC, a.id DESC`;

  const stmt =
    status === 'all'
      ? db
          .prepare(
            `SELECT ${cols} FROM applications a JOIN cities c ON c.id = a.city_id
             WHERE a.deleted_at IS NULL AND a.season_year = ? AND ${nameFilter} ${order}`,
          )
          .bind(seasonYear, like, like, like)
      : db
          .prepare(
            `SELECT ${cols} FROM applications a JOIN cities c ON c.id = a.city_id
             WHERE a.deleted_at IS NULL AND a.season_year = ? AND a.status = ? AND ${nameFilter} ${order}`,
          )
          .bind(seasonYear, status, like, like, like);

  const { results } = await stmt.all<ApplicationListRow>();
  return results;
}

export async function listSeasons(db: D1Database): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT season_year FROM applications WHERE deleted_at IS NULL ORDER BY season_year DESC')
    .all<{ season_year: number }>();
  return results.map((r) => r.season_year);
}

export type ApplicationDetail = {
  app: Record<string, unknown>;
  city_name: string;
  members: Record<string, unknown>[];
  employers: Record<string, unknown>[];
};

export async function getApplicationDetail(db: D1Database, id: number): Promise<ApplicationDetail | null> {
  const app = await db
    .prepare('SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!app) return null;
  const city = await db
    .prepare('SELECT name FROM cities WHERE id = ?')
    .bind(app.city_id as number)
    .first<{ name: string }>();
  const members = await db
    .prepare('SELECT * FROM household_members WHERE application_id = ? ORDER BY position')
    .bind(id)
    .all<Record<string, unknown>>();
  const employers = await db
    .prepare('SELECT * FROM employers WHERE application_id = ? ORDER BY id')
    .bind(id)
    .all<Record<string, unknown>>();
  return {
    app,
    city_name: city?.name ?? '',
    members: members.results,
    employers: employers.results,
  };
}

export async function assignPuNumber(db: D1Database, id: number, seasonYear: number): Promise<number> {
  const current = await db
    .prepare('SELECT pu_number FROM applications WHERE id = ?')
    .bind(id)
    .first<{ pu_number: number | null }>();
  if (current?.pu_number != null) return current.pu_number;
  const max = await db
    .prepare('SELECT COALESCE(MAX(pu_number), 0) AS m FROM applications WHERE season_year = ?')
    .bind(seasonYear)
    .first<{ m: number }>();
  const next = (max?.m ?? 0) + 1;
  await db.prepare('UPDATE applications SET pu_number = ? WHERE id = ?').bind(next, id).run();
  return next;
}

export async function setApplicationStatus(
  db: D1Database,
  id: number,
  status: 'approved' | 'denied',
): Promise<void> {
  await db.prepare('UPDATE applications SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function setBagsCount(db: D1Database, id: number, bags: number | null): Promise<void> {
  await db.prepare('UPDATE applications SET bags_count = ? WHERE id = ?').bind(bags, id).run();
}

export async function softDeleteApplication(db: D1Database, id: number, nowIso: string): Promise<void> {
  await db.prepare('UPDATE applications SET deleted_at = ? WHERE id = ?').bind(nowIso, id).run();
}

export async function restoreApplication(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE applications SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export type ApplicationCoreEdit = {
  firstName: string;
  lastName: string;
  address: string;
  cityId: number;
  phone: string;
  email: string;
  diabetic: boolean;
  shareWithSponsor: boolean;
  permanentlyDisabled: boolean;
  bedChoice: 'sheets' | 'blanket' | 'none';
  bedSize: 'twin' | 'full' | 'queen' | 'king' | null;
  yearsReceivedHelp: number;
  adoptedLastYear: boolean;
  householdType: 'family' | 'elderly' | 'disabled';
};

export async function updateApplicationCore(db: D1Database, id: number, f: ApplicationCoreEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE applications SET
         first_name = ?, last_name = ?, address = ?, city_id = ?, phone = ?, email = ?,
         diabetic = ?, share_with_sponsor = ?, permanently_disabled = ?,
         bed_choice = ?, bed_size = ?, years_received_help = ?, adopted_last_year = ?, household_type = ?
       WHERE id = ?`,
    )
    .bind(
      f.firstName, f.lastName, f.address, f.cityId, f.phone, f.email,
      f.diabetic ? 1 : 0, f.shareWithSponsor ? 1 : 0, f.permanentlyDisabled ? 1 : 0,
      f.bedChoice, f.bedSize, f.yearsReceivedHelp, f.adoptedLastYear ? 1 : 0, f.householdType,
      id,
    )
    .run();
}

export type ExportRow = {
  pu_number: number | null;
  status: string;
  submitted_at: string;
  first_name: string;
  last_name: string;
  address: string;
  city_name: string;
  phone: string;
  email: string;
  household_type: string;
  may_not_be_eligible: number;
  bags_count: number | null;
  member_summary: string;
};

export async function listApplicationsForExport(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
): Promise<ExportRow[]> {
  const statusFilter = status === 'all' ? '' : 'AND a.status = ?2';
  const sql = `
    SELECT a.pu_number, a.status, a.submitted_at, a.first_name, a.last_name, a.address,
           c.name AS city_name, a.phone, a.email, a.household_type, a.may_not_be_eligible, a.bags_count,
           COALESCE(GROUP_CONCAT(m.name || ' (' || m.age || ')', '; '), '') AS member_summary
    FROM applications a
    JOIN cities c ON c.id = a.city_id
    LEFT JOIN household_members m ON m.application_id = a.id
    WHERE a.deleted_at IS NULL AND a.season_year = ?1 ${statusFilter}
    GROUP BY a.id
    ORDER BY a.submitted_at DESC, a.id DESC`;
  const stmt =
    status === 'all'
      ? db.prepare(sql).bind(seasonYear)
      : db.prepare(sql).bind(seasonYear, status);
  const { results } = await stmt.all<ExportRow>();
  return results;
}

export async function listApprovedForSlips(db: D1Database, seasonYear: number): Promise<ApplicationDetail[]> {
  const apps = await db
    .prepare(
      `SELECT * FROM applications
       WHERE deleted_at IS NULL AND season_year = ? AND status = 'approved'
       ORDER BY pu_number IS NULL, pu_number, id`,
    )
    .bind(seasonYear)
    .all<Record<string, unknown>>();
  if (apps.results.length === 0) return [];

  // Fetch cities and members by JOINing to the approved-season set so the number
  // of BOUND PARAMETERS stays 1 regardless of how many apps are approved — D1
  // caps bound parameters at 100 per query, so an IN(...id list) would fail at scale.
  const [cities, members] = await Promise.all([
    db
      .prepare(
        `SELECT DISTINCT c.id, c.name FROM cities c
         JOIN applications a ON a.city_id = c.id
         WHERE a.deleted_at IS NULL AND a.season_year = ? AND a.status = 'approved'`,
      )
      .bind(seasonYear)
      .all<{ id: number; name: string }>(),
    db
      .prepare(
        `SELECT hm.* FROM household_members hm
         JOIN applications a ON a.id = hm.application_id
         WHERE a.deleted_at IS NULL AND a.season_year = ? AND a.status = 'approved'
         ORDER BY hm.application_id, hm.position`,
      )
      .bind(seasonYear)
      .all<Record<string, unknown>>(),
  ]);

  const cityById = new Map(cities.results.map((c) => [c.id, c.name]));
  const membersByApp = new Map<number, Record<string, unknown>[]>();
  for (const m of members.results) {
    const aid = m.application_id as number;
    if (!membersByApp.has(aid)) membersByApp.set(aid, []);
    membersByApp.get(aid)!.push(m);
  }

  return apps.results.map((app) => ({
    app,
    city_name: cityById.get(app.city_id as number) ?? '',
    members: membersByApp.get(app.id as number) ?? [],
    employers: [], // SlipCard does not render employers
  }));
}

export async function setApplicationsOpen(db: D1Database, open: boolean): Promise<void> {
  await db.prepare('UPDATE settings SET applications_open = ? WHERE id = 1').bind(open ? 1 : 0).run();
}

export async function updatePickupText(
  db: D1Database,
  v: { title: string; intro: string; footer: string },
): Promise<void> {
  await db
    .prepare('UPDATE settings SET pickup_title = ?, pickup_intro = ?, pickup_footer = ? WHERE id = 1')
    .bind(v.title, v.intro, v.footer)
    .run();
}

export async function setPdfUploadedAt(db: D1Database, iso: string): Promise<void> {
  await db.prepare('UPDATE settings SET pdf_uploaded_at = ? WHERE id = 1').bind(iso).run();
}

export type AdminContentBlock = {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  sort_order: number;
};

export async function listAllContentBlocks(db: D1Database): Promise<AdminContentBlock[]> {
  const { results } = await db
    .prepare('SELECT id, title, subtitle, body, sort_order FROM content_blocks WHERE deleted_at IS NULL ORDER BY sort_order, id')
    .all<AdminContentBlock>();
  return results;
}

export async function createContentBlock(
  db: D1Database,
  v: { title: string; subtitle: string; body: string },
): Promise<number> {
  const max = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM content_blocks WHERE deleted_at IS NULL')
    .first<{ m: number }>();
  const res = await db
    .prepare('INSERT INTO content_blocks (title, subtitle, body, sort_order) VALUES (?, ?, ?, ?)')
    .bind(v.title, v.subtitle, v.body, (max?.m ?? 0) + 1)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateContentBlock(
  db: D1Database,
  id: number,
  v: { title: string; subtitle: string; body: string },
): Promise<void> {
  await db
    .prepare('UPDATE content_blocks SET title = ?, subtitle = ?, body = ? WHERE id = ?')
    .bind(v.title, v.subtitle, v.body, id)
    .run();
}

export async function softDeleteContentBlock(db: D1Database, id: number, iso: string): Promise<void> {
  await db.prepare('UPDATE content_blocks SET deleted_at = ? WHERE id = ?').bind(iso, id).run();
}

export async function restoreContentBlock(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE content_blocks SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export async function moveContentBlock(db: D1Database, id: number, dir: 'up' | 'down'): Promise<void> {
  const rows = await listAllContentBlocks(db);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.batch(
    rows.map((r, idx) =>
      db.prepare('UPDATE content_blocks SET sort_order = ? WHERE id = ?').bind(idx + 1, r.id),
    ),
  );
}

export type AdminPickupDay = {
  id: number;
  date_text: string;
  description: string;
  sort_order: number;
};

export async function listAllPickupDays(db: D1Database): Promise<AdminPickupDay[]> {
  const { results } = await db
    .prepare('SELECT id, date_text, description, sort_order FROM pickup_days WHERE deleted_at IS NULL ORDER BY sort_order, id')
    .all<AdminPickupDay>();
  return results;
}

export async function createPickupDay(
  db: D1Database,
  v: { date_text: string; description: string },
): Promise<number> {
  const max = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM pickup_days WHERE deleted_at IS NULL')
    .first<{ m: number }>();
  const res = await db
    .prepare('INSERT INTO pickup_days (date_text, description, sort_order) VALUES (?, ?, ?)')
    .bind(v.date_text, v.description, (max?.m ?? 0) + 1)
    .run();
  return res.meta.last_row_id as number;
}

export async function updatePickupDay(
  db: D1Database,
  id: number,
  v: { date_text: string; description: string },
): Promise<void> {
  await db
    .prepare('UPDATE pickup_days SET date_text = ?, description = ? WHERE id = ?')
    .bind(v.date_text, v.description, id)
    .run();
}

export async function softDeletePickupDay(db: D1Database, id: number, iso: string): Promise<void> {
  await db.prepare('UPDATE pickup_days SET deleted_at = ? WHERE id = ?').bind(iso, id).run();
}

export async function restorePickupDay(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE pickup_days SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export async function movePickupDay(db: D1Database, id: number, dir: 'up' | 'down'): Promise<void> {
  const rows = await listAllPickupDays(db);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.batch(
    rows.map((r, idx) =>
      db.prepare('UPDATE pickup_days SET sort_order = ? WHERE id = ?').bind(idx + 1, r.id),
    ),
  );
}

export type MemberEdit = {
  name: string; relationship: string; sex: string; age: number;
  pants: string; shirtTop: string; underwear: string; socks: string; diapers: string; gifts: string;
};

export async function insertMember(db: D1Database, applicationId: number, m: MemberEdit): Promise<number> {
  const max = await db
    .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM household_members WHERE application_id = ?')
    .bind(applicationId)
    .first<{ m: number }>();
  const res = await db
    .prepare(
      `INSERT INTO household_members
         (application_id, position, name, relationship, sex, age, pants, shirt_top, underwear, socks, diapers, gifts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(applicationId, (max?.m ?? 0) + 1, m.name, m.relationship, m.sex, m.age, m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.gifts)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateMember(db: D1Database, id: number, applicationId: number, m: MemberEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE household_members SET
         name = ?, relationship = ?, sex = ?, age = ?,
         pants = ?, shirt_top = ?, underwear = ?, socks = ?, diapers = ?, gifts = ?
       WHERE id = ? AND application_id = ?`,
    )
    .bind(m.name, m.relationship, m.sex, m.age, m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.gifts, id, applicationId)
    .run();
}

export async function deleteMember(db: D1Database, id: number, applicationId: number): Promise<void> {
  await db.prepare('DELETE FROM household_members WHERE id = ? AND application_id = ?').bind(id, applicationId).run();
  // Renumber the survivors 1..n by ascending position so gaps do not accumulate.
  const { results } = await db
    .prepare('SELECT id FROM household_members WHERE application_id = ? ORDER BY position, id')
    .bind(applicationId)
    .all<{ id: number }>();
  if (results.length > 0) {
    await db.batch(
      results.map((r, i) =>
        db.prepare('UPDATE household_members SET position = ? WHERE id = ?').bind(i + 1, r.id)),
    );
  }
}
