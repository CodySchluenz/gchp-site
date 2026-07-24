import type { CleanApplication } from './validation/application';
import { blockBaseFor, blockRange, BLOCK_SIZE } from './pickup-numbers';

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
  straggler_pickup_day_id: number | null;
};

export async function getSettings(db: D1Database): Promise<Settings> {
  const row = await db
    .prepare(
      'SELECT applications_open, pickup_title, pickup_intro, pickup_footer, pdf_uploaded_at, straggler_pickup_day_id FROM settings WHERE id = 1',
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

export type City = { id: number; name: string; block_base: number; pickup_day_id: number | null };

export async function listCities(db: D1Database): Promise<City[]> {
  const { results } = await db.prepare('SELECT id, name, block_base, pickup_day_id FROM cities ORDER BY name').all<City>();
  return results;
}

// Assign (or clear, dayId = null) the pickup day a town's slips resolve to.
// Unset means slips print with no date line — see migrations/0008.
export async function setCityPickupDay(db: D1Database, cityId: number, dayId: number | null): Promise<void> {
  await db.prepare('UPDATE cities SET pickup_day_id = ? WHERE id = ?').bind(dayId, cityId).run();
}

// Assign (or clear) the pickup day straggler applications resolve to,
// independent of the applicant's town.
export async function setStragglerPickupDay(db: D1Database, dayId: number | null): Promise<void> {
  await db.prepare('UPDATE settings SET straggler_pickup_day_id = ? WHERE id = 1').bind(dayId).run();
}

export type NewApplication = CleanApplication & {
  seasonYear: number;
  submittedAt: string;
  householdType: 'family' | 'elderly' | 'disabled';
  source?: 'online' | 'paper';
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
         good_deed, parentage_note, source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      app.goodDeed, app.parentageNote ?? '', app.source ?? 'online',
    )
    .run();

  const appId = res.meta.last_row_id as number;

  const statements = [
    ...app.members.map((m, i) =>
      db
        .prepare(
          `INSERT INTO household_members
             (application_id, position, name, relationship, relationship_other, sex, age,
              disabled, part_time, doll, pants, shirt_top, underwear, socks, diapers, shoe, coat, gifts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          appId, i + 1, m.name, m.relationship, m.relationshipOther ?? '', m.sex, m.age,
          m.disabled ? 1 : 0, m.partTime ? 1 : 0, m.doll ?? '',
          m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.shoe ?? '', m.coat ?? '', m.gifts,
        ),
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
  address: string;
  city_name: string;
  submitted_at: string;
  status: string;
  pu_number: number | null;
  straggler: number;
  household_type: string;
};

// Escape LIKE metacharacters so operator-typed % or _ match literally.
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listApplications(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
  search: string,
  town: number | 'mailed' | 'stragglers' | null = null,
): Promise<ApplicationListRow[]> {
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const cols = `a.id, a.first_name, a.last_name, a.address, c.name AS city_name, a.submitted_at,
                a.status, a.pu_number, a.straggler, a.household_type`;
  const order = town !== null
    ? 'ORDER BY a.pu_number IS NULL, a.pu_number, a.id'
    : 'ORDER BY a.submitted_at DESC, a.id DESC';
  const { results } = await db
    .prepare(
      `SELECT ${cols} FROM applications a JOIN cities c ON c.id = a.city_id
       WHERE a.deleted_at IS NULL AND a.season_year = ?1
         AND (?2 = '' OR a.status = ?2)
         AND (?3 = '%%' OR lower(a.first_name) LIKE ?3 ESCAPE '\\' OR lower(a.last_name) LIKE ?3 ESCAPE '\\')
         AND (?4 = 0 OR a.city_id = ?4)
         AND (?5 = 0 OR a.household_type IN ('elderly', 'disabled'))
         AND (?6 = 0 OR a.straggler = 1)
       ${order}`,
    )
    .bind(
      seasonYear, status === 'all' ? '' : status, like,
      typeof town === 'number' ? town : 0, town === 'mailed' ? 1 : 0, town === 'stragglers' ? 1 : 0,
    )
    .all<ApplicationListRow>();
  return results;
}

export async function listSeasons(db: D1Database): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT season_year FROM applications WHERE deleted_at IS NULL ORDER BY season_year DESC')
    .all<{ season_year: number }>();
  return results.map((r) => r.season_year);
}

// The most recent season with any (non-deleted) applications. Used to pick
// the season the operator lands on by default — see latestSeason's callers.
// Null on a brand-new database with no applications at all.
export async function latestSeason(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare('SELECT MAX(season_year) AS max_year FROM applications WHERE deleted_at IS NULL')
    .first<{ max_year: number | null }>();
  return row?.max_year ?? null;
}

export type ApplicationDetail = {
  app: Record<string, unknown>;
  city_name: string;
  members: Record<string, unknown>[];
  employers: Record<string, unknown>[];
  pickup_day: { date_text: string; description: string } | null;
};

// The ONE pickup-day resolution rule, shared by the bulk slips path
// (listApprovedForSlips) and single-slip reprints (getApplicationDetail):
// stragglers use the straggler day and NEVER fall back to their town's day;
// everyone else uses their town's day. Null means "no date line on the slip".
function pickupDayIdFor(
  straggler: number,
  stragglerDayId: number | null,
  cityDayId: number | null,
): number | null {
  return straggler === 1 ? stragglerDayId : cityDayId;
}

export async function getApplicationDetail(db: D1Database, id: number): Promise<ApplicationDetail | null> {
  const app = await db
    .prepare('SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!app) return null;
  const city = await db
    .prepare('SELECT name, pickup_day_id FROM cities WHERE id = ?')
    .bind(app.city_id as number)
    .first<{ name: string; pickup_day_id: number | null }>();
  const members = await db
    .prepare('SELECT * FROM household_members WHERE application_id = ? AND deleted_at IS NULL ORDER BY position')
    .bind(id)
    .all<Record<string, unknown>>();
  const employers = await db
    .prepare('SELECT * FROM employers WHERE application_id = ? AND deleted_at IS NULL ORDER BY id')
    .bind(id)
    .all<Record<string, unknown>>();
  // Resolve the pickup day here too — single-slip reprints print through this
  // view, so it must agree with the bulk slips path (see pickupDayIdFor).
  // Mailed households (elderly/disabled) receive by mail and never pick up, so
  // a dated slip would mislead — always null for them. (The bulk slips path
  // already excludes mailed households at the query level.)
  const mailed = app.household_type === 'elderly' || app.household_type === 'disabled';
  const settings = await db
    .prepare('SELECT straggler_pickup_day_id FROM settings WHERE id = 1')
    .first<{ straggler_pickup_day_id: number | null }>();
  const dayId = mailed ? null : pickupDayIdFor(
    app.straggler as number,
    settings?.straggler_pickup_day_id ?? null,
    city?.pickup_day_id ?? null,
  );
  const pickupDay = dayId != null
    ? await db
        .prepare('SELECT date_text, description FROM pickup_days WHERE deleted_at IS NULL AND id = ?')
        .bind(dayId)
        .first<{ date_text: string; description: string }>()
    : null;
  return {
    app,
    city_name: city?.name ?? '',
    members: members.results,
    employers: employers.results,
    pickup_day: pickupDay ?? null, // missing/deleted/unset day -> null (no date line)
  };
}

export async function assignPuNumber(db: D1Database, id: number, seasonYear: number): Promise<number | null> {
  const info = await db
    .prepare(
      `SELECT a.household_type, a.straggler, a.pu_number, c.block_base
       FROM applications a JOIN cities c ON c.id = a.city_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<{ household_type: 'family' | 'elderly' | 'disabled'; straggler: number; pu_number: number | null; block_base: number }>();
  if (!info) return null;
  if (info.pu_number != null) return info.pu_number; // idempotent
  const base = blockBaseFor({ householdType: info.household_type, straggler: info.straggler === 1, cityBlockBase: info.block_base });
  if (base <= 0) return null; // unseeded city: operator assigns by hand
  const { min, max } = blockRange(base);
  // Single guarded UPDATE: only fills a NULL pu_number, and only while the
  // next number still fits the block (fail-soft otherwise). The MAX scan has
  // no deleted_at filter on purpose — numbers are never reused, even after a
  // delete + restore (existing invariant, now per block).
  await db
    .prepare(
      `UPDATE applications
         SET pu_number = (SELECT COALESCE(MAX(pu_number) + 1, ?3) FROM applications
                          WHERE season_year = ?1 AND pu_number BETWEEN ?3 AND ?4)
       WHERE id = ?2 AND season_year = ?1 AND pu_number IS NULL
         AND (SELECT COALESCE(MAX(pu_number) + 1, ?3) FROM applications
              WHERE season_year = ?1 AND pu_number BETWEEN ?3 AND ?4) <= ?4`,
    )
    .bind(seasonYear, id, min, max)
    .run();
  const row = await db.prepare('SELECT pu_number FROM applications WHERE id = ?').bind(id).first<{ pu_number: number | null }>();
  return row?.pu_number ?? null;
}

// Manual set (or clear, n = null) for the paper hybrid and odd cases like the
// 2600 numbers. Duplicate check includes soft-deleted rows — never reuse.
export async function setPuNumber(
  db: D1Database, id: number, seasonYear: number, n: number | null,
): Promise<{ ok: true } | { ok: false; takenBy: number }> {
  if (n != null) {
    const clash = await db
      .prepare('SELECT id FROM applications WHERE season_year = ? AND pu_number = ? AND id != ?')
      .bind(seasonYear, n, id)
      .first<{ id: number }>();
    if (clash) return { ok: false, takenBy: clash.id };
  }
  await db.prepare('UPDATE applications SET pu_number = ? WHERE id = ?').bind(n, id).run();
  return { ok: true };
}

export async function setStraggler(db: D1Database, id: number, on: boolean): Promise<void> {
  await db.prepare('UPDATE applications SET straggler = ? WHERE id = ?').bind(on ? 1 : 0, id).run();
}

// How many numbers a block has used this season (soft-deleted rows count).
export async function countBlockUsage(db: D1Database, seasonYear: number, base: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM applications WHERE season_year = ? AND pu_number BETWEEN ? AND ?')
    .bind(seasonYear, base, base + BLOCK_SIZE - 1)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function setApplicationStatus(
  db: D1Database,
  id: number,
  status: 'approved' | 'denied',
): Promise<void> {
  await db
    .prepare('UPDATE applications SET status = ?, decided_at = ? WHERE id = ?')
    .bind(status, new Date().toISOString(), id)
    .run();
}

export async function setBagsCount(db: D1Database, id: number, bags: number | null): Promise<void> {
  await db.prepare('UPDATE applications SET bags_count = ? WHERE id = ?').bind(bags, id).run();
}

export async function setApplicationNotes(db: D1Database, id: number, notes: string): Promise<void> {
  await db.prepare('UPDATE applications SET admin_notes = ? WHERE id = ?').bind(notes, id).run();
}

// Sherlyn hands a Thanksgiving card to the first 30 applicants each season
// and tracks food/gift cards per household (mostly the mailed ones). She
// records them here herself — the site never marks anything automatically.
export const THANKSGIVING_CARD_TOTAL = 30;

export type CardsGiven = {
  thanksgivingCard: boolean;
  foodCard: boolean; foodCardAmount: number | null;
  giftCard: boolean; giftCardAmount: number | null;
};

export async function setCardsGiven(db: D1Database, id: number, c: CardsGiven): Promise<void> {
  await db
    .prepare(
      `UPDATE applications SET thanksgiving_card = ?, food_card = ?, food_card_amount = ?, gift_card = ?, gift_card_amount = ? WHERE id = ?`,
    )
    .bind(c.thanksgivingCard ? 1 : 0, c.foodCard ? 1 : 0, c.foodCardAmount, c.giftCard ? 1 : 0, c.giftCardAmount, id)
    .run();
}

export async function thanksgivingCount(db: D1Database, seasonYear: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM applications WHERE deleted_at IS NULL AND season_year = ? AND thanksgiving_card = 1')
    .bind(seasonYear)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function softDeleteApplication(db: D1Database, id: number, nowIso: string): Promise<void> {
  await db.prepare('UPDATE applications SET deleted_at = ? WHERE id = ?').bind(nowIso, id).run();
}

export async function restoreApplication(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE applications SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export type ApplicationFullEdit = {
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
  fullTimeResidenceConfirmed: boolean;
  noEmploymentConfirmed: boolean;
  foodShareAmount: number | null;
  socialSecurityAmount: number | null;
  socialSecurityFor: string;
  ssiAmount: number | null;
  ssiFor: string;
  childSupportAmount: number | null;
  childSupportFor: string;
  unemploymentWeeklyAmount: number | null;
  unemploymentFor: string;
  otherIncomeAmount: number | null;
  otherIncomeFor: string;
  goodDeed: string;
  parentageNote: string;
};

export async function updateApplicationFull(db: D1Database, id: number, f: ApplicationFullEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE applications SET
         first_name = ?, last_name = ?, address = ?, city_id = ?, phone = ?, email = ?,
         diabetic = ?, share_with_sponsor = ?, permanently_disabled = ?,
         bed_choice = ?, bed_size = ?, years_received_help = ?, adopted_last_year = ?, household_type = ?,
         full_time_residence_confirmed = ?, no_employment_confirmed = ?,
         food_share_amount = ?,
         social_security_amount = ?, social_security_for = ?,
         ssi_amount = ?, ssi_for = ?,
         child_support_amount = ?, child_support_for = ?,
         unemployment_weekly_amount = ?, unemployment_for = ?,
         other_income_amount = ?, other_income_for = ?,
         good_deed = ?, parentage_note = ?
       WHERE id = ?`,
    )
    .bind(
      f.firstName, f.lastName, f.address, f.cityId, f.phone, f.email,
      f.diabetic ? 1 : 0, f.shareWithSponsor ? 1 : 0, f.permanentlyDisabled ? 1 : 0,
      f.bedChoice, f.bedSize, f.yearsReceivedHelp, f.adoptedLastYear ? 1 : 0, f.householdType,
      f.fullTimeResidenceConfirmed ? 1 : 0, f.noEmploymentConfirmed ? 1 : 0,
      f.foodShareAmount,
      f.socialSecurityAmount, f.socialSecurityFor,
      f.ssiAmount, f.ssiFor,
      f.childSupportAmount, f.childSupportFor,
      f.unemploymentWeeklyAmount, f.unemploymentFor,
      f.otherIncomeAmount, f.otherIncomeFor,
      f.goodDeed, f.parentageNote,
      id,
    )
    .run();
}

export type ExportRow = {
  pu_number: number | null;
  status: string;
  submitted_at: string;
  decided_at: string | null;
  first_name: string;
  last_name: string;
  address: string;
  city_name: string;
  phone: string;
  email: string;
  household_type: string;
  bags_count: number | null;
  parentage_note: string;
  admin_notes: string;
  years_received_help: number;
  adopted_last_year: number;
  bed_choice: string;
  bed_size: string | null;
  food_share_amount: number | null;
  social_security_amount: number | null;
  ssi_amount: number | null;
  child_support_amount: number | null;
  unemployment_weekly_amount: number | null;
  other_income_amount: number | null;
  member_count: number;
  member_summary: string;
  gifts_summary: string;
  dolls_summary: string;
  employment_summary: string;
  thanksgiving_card: number;
  food_card: number;
  food_card_amount: number | null;
  gift_card: number;
  gift_card_amount: number | null;
  source: string;
};

export async function listApplicationsForExport(
  db: D1Database,
  seasonYear: number,
  status: 'all' | 'new' | 'approved' | 'denied',
  search: string,
  town: number | 'mailed' | 'stragglers' | null = null,
): Promise<ExportRow[]> {
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const statusFilter = status === 'all' ? '' : 'AND a.status = ?2';
  // Name filter is a no-op when the search box is empty (like === '%%').
  const nameFilter = `AND (?3 = '%%' OR lower(a.first_name) LIKE ?3 ESCAPE '\\' OR lower(a.last_name) LIKE ?3 ESCAPE '\\')`;
  const townFilter = `AND (?4 = 0 OR a.city_id = ?4)`;
  const mailedFilter = `AND (?5 = 0 OR a.household_type IN ('elderly', 'disabled'))`;
  const stragglerFilter = `AND (?6 = 0 OR a.straggler = 1)`;
  const order = town !== null
    ? 'ORDER BY a.pu_number IS NULL, a.pu_number, a.id'
    : 'ORDER BY a.submitted_at DESC, a.id DESC';
  const sql = `
    SELECT a.pu_number, a.status, a.submitted_at, a.decided_at, a.source, a.first_name, a.last_name, a.address,
           c.name AS city_name, a.phone, a.email, a.household_type, a.bags_count,
           a.parentage_note, a.admin_notes,
           a.years_received_help, a.adopted_last_year, a.bed_choice, a.bed_size,
           a.food_share_amount, a.social_security_amount, a.ssi_amount, a.child_support_amount,
           a.unemployment_weekly_amount, a.other_income_amount,
           a.thanksgiving_card, a.food_card, a.food_card_amount, a.gift_card, a.gift_card_amount,
           COUNT(DISTINCT m.id) AS member_count,
           COALESCE(GROUP_CONCAT(
             m.name || ' (' ||
             -- Duplicates the relationship->label mapping in relationshipLabel() (src/lib/relationships.ts),
             -- intentionally with export-specific wording. Update both when adding a 9th relationship value.
             CASE m.relationship
               WHEN 'self' THEN 'self'
               WHEN 'other_parent' THEN 'parent'
               WHEN 'son' THEN 'son'
               WHEN 'daughter' THEN 'daughter'
               WHEN 'grandchild' THEN 'grandchild'
               WHEN 'court' THEN 'court-appointed'
               WHEN 'not_related' THEN 'not related'
               WHEN 'other' THEN COALESCE(NULLIF(m.relationship_other, ''), 'other')
               ELSE COALESCE(NULLIF(m.relationship, ''), '?')
             END
             || ', age ' || m.age ||
             CASE WHEN m.disabled = 1 THEN ', disabled' ELSE '' END ||
             CASE WHEN m.part_time = 1 THEN ', part-time' ELSE '' END ||
             CASE WHEN m.doll = 'black' THEN ', black doll' WHEN m.doll = 'white' THEN ', white doll' ELSE '' END ||
             ')', '; '), '') AS member_summary,
           COALESCE(GROUP_CONCAT(CASE WHEN m.gifts != '' THEN m.name || ': ' || m.gifts END, '; '), '') AS gifts_summary,
           COALESCE(GROUP_CONCAT(CASE m.doll WHEN 'black' THEN 'Black doll (' || m.name || ')' WHEN 'white' THEN 'White doll (' || m.name || ')' END, '; '), '') AS dolls_summary,
           (SELECT COALESCE(GROUP_CONCAT(e.worker_name || ' @ ' || e.employer_name || ': $' || e.hourly_wage || ' x ' || e.hours_per_week, '; '), '')
              FROM employers e WHERE e.application_id = a.id AND e.deleted_at IS NULL) AS employment_summary
    FROM applications a
    JOIN cities c ON c.id = a.city_id
    LEFT JOIN household_members m ON m.application_id = a.id AND m.deleted_at IS NULL
    WHERE a.deleted_at IS NULL AND a.season_year = ?1 ${statusFilter} ${nameFilter} ${townFilter} ${mailedFilter} ${stragglerFilter}
    GROUP BY a.id
    ${order}`;
  const stmt = db
    .prepare(sql)
    .bind(
      seasonYear, status === 'all' ? '' : status, like,
      typeof town === 'number' ? town : 0, town === 'mailed' ? 1 : 0, town === 'stragglers' ? 1 : 0,
    );
  const { results } = await stmt.all<ExportRow>();
  return results;
}

export async function listApprovedForSlips(db: D1Database, seasonYear: number): Promise<ApplicationDetail[]> {
  const apps = await db
    .prepare(
      `SELECT * FROM applications
       WHERE deleted_at IS NULL AND season_year = ? AND status = 'approved'
         AND household_type NOT IN ('elderly', 'disabled')
       ORDER BY pu_number IS NULL, pu_number, id`,
    )
    .bind(seasonYear)
    .all<Record<string, unknown>>();
  if (apps.results.length === 0) return [];

  // Fetch cities and members by JOINing to the approved-season set so the number
  // of BOUND PARAMETERS stays 1 regardless of how many apps are approved — D1
  // caps bound parameters at 100 per query, so an IN(...id list) would fail at scale.
  // Pickup days (non-deleted) and the straggler day are both small, unfiltered
  // reads — cheap to fetch every time so a deleted day silently stops resolving.
  const [cities, members, pickupDays, settings] = await Promise.all([
    db
      .prepare(
        `SELECT DISTINCT c.id, c.name, c.pickup_day_id FROM cities c
         JOIN applications a ON a.city_id = c.id
         WHERE a.deleted_at IS NULL AND a.season_year = ? AND a.status = 'approved'
           AND a.household_type NOT IN ('elderly', 'disabled')`,
      )
      .bind(seasonYear)
      .all<{ id: number; name: string; pickup_day_id: number | null }>(),
    db
      .prepare(
        `SELECT hm.* FROM household_members hm
         JOIN applications a ON a.id = hm.application_id
         WHERE a.deleted_at IS NULL AND hm.deleted_at IS NULL AND a.season_year = ? AND a.status = 'approved'
           AND a.household_type NOT IN ('elderly', 'disabled')
         ORDER BY hm.application_id, hm.position`,
      )
      .bind(seasonYear)
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT id, date_text, description FROM pickup_days WHERE deleted_at IS NULL')
      .all<{ id: number; date_text: string; description: string }>(),
    db
      .prepare('SELECT straggler_pickup_day_id FROM settings WHERE id = 1')
      .first<{ straggler_pickup_day_id: number | null }>(),
  ]);

  const cityById = new Map(cities.results.map((c) => [c.id, c]));
  const membersByApp = new Map<number, Record<string, unknown>[]>();
  for (const m of members.results) {
    const aid = m.application_id as number;
    if (!membersByApp.has(aid)) membersByApp.set(aid, []);
    membersByApp.get(aid)!.push(m);
  }
  const dayById = new Map(pickupDays.results.map((d) => [d.id, { date_text: d.date_text, description: d.description }]));
  const stragglerDayId = settings?.straggler_pickup_day_id ?? null;

  return apps.results.map((app) => {
    const city = cityById.get(app.city_id as number);
    const dayId = pickupDayIdFor(app.straggler as number, stragglerDayId, city?.pickup_day_id ?? null);
    return {
      app,
      city_name: city?.name ?? '',
      members: membersByApp.get(app.id as number) ?? [],
      employers: [], // SlipCard does not render employers
      pickup_day: dayId != null ? (dayById.get(dayId) ?? null) : null,
    };
  });
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
  name: string; relationship: string; relationshipOther?: string; sex: string; age: number;
  disabled?: boolean; partTime?: boolean; doll?: string;
  pants: string; shirtTop: string; underwear: string; socks: string; diapers: string; shoe?: string; coat?: string; gifts: string;
};

export async function insertMember(db: D1Database, applicationId: number, m: MemberEdit): Promise<number> {
  // MAX(position) has no deleted_at filter, so it keeps counting soft-deleted
  // rows — harmless: position is just display order within this application,
  // not a stable identity, so a gap or a reused-looking number costs nothing.
  const max = await db
    .prepare('SELECT COALESCE(MAX(position), 0) AS m FROM household_members WHERE application_id = ?')
    .bind(applicationId)
    .first<{ m: number }>();
  const res = await db
    .prepare(
      `INSERT INTO household_members
         (application_id, position, name, relationship, relationship_other, sex, age,
          disabled, part_time, doll, pants, shirt_top, underwear, socks, diapers, shoe, coat, gifts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      applicationId, (max?.m ?? 0) + 1, m.name, m.relationship, m.relationshipOther ?? '', m.sex, m.age,
      m.disabled ? 1 : 0, m.partTime ? 1 : 0, m.doll ?? '',
      m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.shoe ?? '', m.coat ?? '', m.gifts,
    )
    .run();
  return res.meta.last_row_id as number;
}

export async function updateMember(db: D1Database, id: number, applicationId: number, m: MemberEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE household_members SET
         name = ?, relationship = ?, relationship_other = ?, sex = ?, age = ?,
         disabled = ?, part_time = ?, doll = ?,
         pants = ?, shirt_top = ?, underwear = ?, socks = ?, diapers = ?, shoe = ?, coat = ?, gifts = ?
       WHERE id = ? AND application_id = ?`,
    )
    .bind(
      m.name, m.relationship, m.relationshipOther ?? '', m.sex, m.age,
      m.disabled ? 1 : 0, m.partTime ? 1 : 0, m.doll ?? '',
      m.pants, m.shirtTop, m.underwear, m.socks, m.diapers, m.shoe ?? '', m.coat ?? '', m.gifts, id, applicationId,
    )
    .run();
}

export async function softDeleteMember(db: D1Database, id: number, applicationId: number, nowIso: string): Promise<void> {
  await db.prepare('UPDATE household_members SET deleted_at = ? WHERE id = ? AND application_id = ?').bind(nowIso, id, applicationId).run();
  // Renumber the surviving (non-deleted) members 1..n by ascending position so gaps do not accumulate.
  const { results } = await db
    .prepare('SELECT id FROM household_members WHERE application_id = ? AND deleted_at IS NULL ORDER BY position, id')
    .bind(applicationId)
    .all<{ id: number }>();
  if (results.length > 0) {
    await db.batch(
      results.map((r, i) =>
        db.prepare('UPDATE household_members SET position = ? WHERE id = ?').bind(i + 1, r.id)),
    );
  }
}

export async function restoreMember(db: D1Database, id: number, applicationId: number): Promise<void> {
  await db.prepare('UPDATE household_members SET deleted_at = NULL WHERE id = ? AND application_id = ?').bind(id, applicationId).run();
}

export type EmployerEdit = { employerName: string; workerName: string; hourlyWage: number; hoursPerWeek: number };

export async function insertEmployer(db: D1Database, applicationId: number, e: EmployerEdit): Promise<number> {
  const res = await db
    .prepare('INSERT INTO employers (application_id, employer_name, worker_name, hourly_wage, hours_per_week) VALUES (?, ?, ?, ?, ?)')
    .bind(applicationId, e.employerName, e.workerName, e.hourlyWage, e.hoursPerWeek)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateEmployer(db: D1Database, id: number, applicationId: number, e: EmployerEdit): Promise<void> {
  await db
    .prepare('UPDATE employers SET employer_name = ?, worker_name = ?, hourly_wage = ?, hours_per_week = ? WHERE id = ? AND application_id = ?')
    .bind(e.employerName, e.workerName, e.hourlyWage, e.hoursPerWeek, id, applicationId)
    .run();
}

export async function softDeleteEmployer(db: D1Database, id: number, applicationId: number, nowIso: string): Promise<void> {
  await db.prepare('UPDATE employers SET deleted_at = ? WHERE id = ? AND application_id = ?').bind(nowIso, id, applicationId).run();
}

export async function restoreEmployer(db: D1Database, id: number, applicationId: number): Promise<void> {
  await db.prepare('UPDATE employers SET deleted_at = NULL WHERE id = ? AND application_id = ?').bind(id, applicationId).run();
}

export type AdminDonor = {
  id: number; name: string; contact_person: string; address: string;
  city: string; state: string; zip: string; phone: string; email: string;
};
export type DonorEdit = Omit<AdminDonor, 'id'>;

export async function listDonors(db: D1Database, search: string): Promise<AdminDonor[]> {
  const like = `%${escapeLike(search.trim().toLowerCase())}%`;
  const { results } = await db
    .prepare(
      `SELECT id, name, contact_person, address, city, state, zip, phone, email
       FROM donors
       WHERE deleted_at IS NULL AND (? = '%%' OR lower(name) LIKE ? ESCAPE '\\')
       ORDER BY name COLLATE NOCASE, id`,
    )
    .bind(like, like)
    .all<AdminDonor>();
  return results;
}

export async function getDonor(db: D1Database, id: number): Promise<AdminDonor | null> {
  return await db
    .prepare(
      `SELECT id, name, contact_person, address, city, state, zip, phone, email
       FROM donors WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<AdminDonor>();
}

export async function createDonor(db: D1Database, f: DonorEdit): Promise<number> {
  const res = await db
    .prepare(
      `INSERT INTO donors (name, contact_person, address, city, state, zip, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(f.name, f.contact_person, f.address, f.city, f.state, f.zip, f.phone, f.email)
    .run();
  return res.meta.last_row_id as number;
}

export async function updateDonor(db: D1Database, id: number, f: DonorEdit): Promise<void> {
  await db
    .prepare(
      `UPDATE donors SET name = ?, contact_person = ?, address = ?, city = ?, state = ?, zip = ?, phone = ?, email = ?
       WHERE id = ?`,
    )
    .bind(f.name, f.contact_person, f.address, f.city, f.state, f.zip, f.phone, f.email, id)
    .run();
}

export async function softDeleteDonor(db: D1Database, id: number, iso: string): Promise<void> {
  await db.prepare('UPDATE donors SET deleted_at = ? WHERE id = ?').bind(iso, id).run();
}

export async function restoreDonor(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE donors SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export type AdminDonation = { id: number; donor_id: number; date: string; item_description: string; amount: number | null };

export async function listDonationsForDonor(db: D1Database, donorId: number): Promise<AdminDonation[]> {
  const { results } = await db
    .prepare(
      `SELECT id, donor_id, date, item_description, amount FROM donations
       WHERE donor_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC`,
    )
    .bind(donorId)
    .all<AdminDonation>();
  return results;
}

export async function createDonation(
  db: D1Database,
  donorId: number,
  v: { date: string; amount: number | null; itemDescription: string },
): Promise<number> {
  const res = await db
    .prepare('INSERT INTO donations (donor_id, date, item_description, amount) VALUES (?, ?, ?, ?)')
    .bind(donorId, v.date, v.itemDescription, v.amount)
    .run();
  return res.meta.last_row_id as number;
}

export async function softDeleteDonation(db: D1Database, id: number, donorId: number, iso: string): Promise<void> {
  await db.prepare('UPDATE donations SET deleted_at = ? WHERE id = ? AND donor_id = ?').bind(iso, id, donorId).run();
}

export async function restoreDonation(db: D1Database, id: number, donorId: number): Promise<void> {
  await db.prepare('UPDATE donations SET deleted_at = NULL WHERE id = ? AND donor_id = ?').bind(id, donorId).run();
}

export async function donationSummaryForYear(db: D1Database, year: string): Promise<{ count: number; total: number }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(d.amount), 0) AS total
       FROM donations d JOIN donors dn ON dn.id = d.donor_id
       WHERE d.deleted_at IS NULL AND dn.deleted_at IS NULL AND substr(d.date, 1, 4) = ?`,
    )
    .bind(year)
    .first<{ count: number; total: number }>();
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

// The distinct calendar years that have (non-deleted) donations, newest first —
// used to let the admin view a past year's donation total, not just the current one.
export async function listDonationYears(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT substr(d.date, 1, 4) AS year
       FROM donations d JOIN donors dn ON dn.id = d.donor_id
       WHERE d.deleted_at IS NULL AND dn.deleted_at IS NULL
       ORDER BY year DESC`,
    )
    .all<{ year: string }>();
  return results.map((r) => r.year);
}

export type AdminMessage = { id: number; received_at: string; name: string; email: string; message: string; read_at: string | null };

export async function listContactMessages(db: D1Database): Promise<AdminMessage[]> {
  const { results } = await db
    .prepare('SELECT id, received_at, name, email, message, read_at FROM contact_messages WHERE deleted_at IS NULL ORDER BY received_at DESC, id DESC')
    .all<AdminMessage>();
  return results;
}

export async function setMessageRead(db: D1Database, id: number, read: boolean, iso: string): Promise<void> {
  await db.prepare('UPDATE contact_messages SET read_at = ? WHERE id = ?').bind(read ? iso : null, id).run();
}

export async function softDeleteContactMessage(db: D1Database, id: number, nowIso: string): Promise<void> {
  await db.prepare('UPDATE contact_messages SET deleted_at = ? WHERE id = ?').bind(nowIso, id).run();
}

export async function restoreContactMessage(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE contact_messages SET deleted_at = NULL WHERE id = ?').bind(id).run();
}

export async function unreadMessageCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS c FROM contact_messages WHERE read_at IS NULL AND deleted_at IS NULL').first<{ c: number }>();
  return row?.c ?? 0;
}
