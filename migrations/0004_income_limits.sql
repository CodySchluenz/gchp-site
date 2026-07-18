-- Income check (2026-07-18 spec): per-season yearly income limits (200% of the
-- HHS poverty guidelines), edited by the operator at /admin/income-limits.
-- Run ONCE against the live DB with `npm run db:migrate:remote`. Fresh DBs
-- (tests) get this via tests/helpers/d1.ts, which applies it after 0003.
CREATE TABLE income_limits (
  season_year INTEGER PRIMARY KEY,
  size_1 INTEGER NOT NULL,
  size_2 INTEGER NOT NULL,
  size_3 INTEGER NOT NULL,
  size_4 INTEGER NOT NULL,
  size_5 INTEGER NOT NULL,
  size_6 INTEGER NOT NULL,
  size_7 INTEGER NOT NULL,
  size_8 INTEGER NOT NULL,
  extra_person INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
-- Seed: 200% of the 2026 HHS poverty guidelines (aspe.hhs.gov, published
-- 2026-01-13, 48 contiguous states: $15,960 for 1, +$5,680 each additional).
-- The admin screen displays these for the operator to verify and correct.
INSERT INTO income_limits (season_year, size_1, size_2, size_3, size_4, size_5, size_6, size_7, size_8, extra_person, updated_at)
VALUES (2026, 31920, 43280, 54640, 66000, 77360, 88720, 100080, 111440, 11360, '2026-07-18T00:00:00Z');
