-- Decision timestamps (2026-07-18 spec): when the operator approves or denies.
-- Nullable: rows decided before this feature show nothing. Run ONCE against
-- the live DB with `npm run db:migrate:remote`; tests apply it via
-- tests/helpers/d1.ts.
ALTER TABLE applications ADD COLUMN decided_at TEXT;
