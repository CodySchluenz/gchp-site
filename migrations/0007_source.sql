-- Where an application came from (2026-07-18 paper-entry spec). Default '' on
-- purpose: rows created before source tracking stay honestly unlabeled.
-- New inserts stamp 'online' (public form) or 'paper' (admin entry).
ALTER TABLE applications ADD COLUMN source TEXT NOT NULL DEFAULT '';
