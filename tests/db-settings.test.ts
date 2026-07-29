import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from './helpers/d1';
import { getSettings, setApplicationsOpen, updatePickupText, setPdfUploadedAt, setElderlyPdfUploadedAt } from '../src/lib/db';

describe('settings writes', () => {
  let db: D1Database;
  let dispose: () => Promise<void>;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('toggles applications_open both ways', async () => {
    await setApplicationsOpen(db, true);
    expect((await getSettings(db)).applications_open).toBe(1);
    await setApplicationsOpen(db, false);
    expect((await getSettings(db)).applications_open).toBe(0);
  });

  it('updates the pickup text fields', async () => {
    await updatePickupText(db, { title: 'T', intro: 'I', footer: 'F' });
    const s = await getSettings(db);
    expect([s.pickup_title, s.pickup_intro, s.pickup_footer]).toEqual(['T', 'I', 'F']);
  });

  it('records the pdf upload time', async () => {
    await setPdfUploadedAt(db, '2026-10-02T00:00:00.000Z');
    expect((await getSettings(db)).pdf_uploaded_at).toBe('2026-10-02T00:00:00.000Z');
  });

  it('records the elderly pdf upload time, independent of the family one', async () => {
    await setElderlyPdfUploadedAt(db, '2026-10-03T00:00:00.000Z');
    const s = await getSettings(db);
    expect(s.elderly_pdf_uploaded_at).toBe('2026-10-03T00:00:00.000Z');
    expect(s.pdf_uploaded_at).toBe('2026-10-02T00:00:00.000Z'); // unaffected by the previous test
  });
});
