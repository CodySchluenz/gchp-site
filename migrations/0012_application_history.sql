-- Application history: one plain-English sentence per change, written by the
-- same code paths that save the change. Read-only; admin-only; purged with
-- its application. Sentences are composed at save time so display never
-- depends on schema archaeology.
CREATE TABLE application_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  area TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX idx_history_app ON application_history(application_id, id);
ALTER TABLE applications ADD COLUMN original_json TEXT;
