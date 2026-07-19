-- Audit fix (2026-07-19 spec §B): member/job/message deletes join the
-- soft-delete + Undo pattern the rest of the app already uses. Nullable on
-- purpose; existing rows unaffected.
ALTER TABLE household_members ADD COLUMN deleted_at TEXT;
ALTER TABLE employers ADD COLUMN deleted_at TEXT;
ALTER TABLE contact_messages ADD COLUMN deleted_at TEXT;
