-- Plan 5: per-person relationship/disability/sizes, blended-family + admin notes.
-- Run ONCE against the live DB with `npm run db:migrate:remote`. Fresh DBs (tests)
-- get these via tests/helpers/d1.ts, which applies this file after 0001.
ALTER TABLE household_members ADD COLUMN relationship_other TEXT NOT NULL DEFAULT '';
ALTER TABLE household_members ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_members ADD COLUMN part_time INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_members ADD COLUMN shoe TEXT NOT NULL DEFAULT '';
ALTER TABLE household_members ADD COLUMN coat TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN parentage_note TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN admin_notes TEXT NOT NULL DEFAULT '';
