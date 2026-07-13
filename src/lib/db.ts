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
