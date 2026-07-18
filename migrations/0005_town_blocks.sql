-- Town-block pickup numbers (2026-07-18 spec): each town owns a 100-number
-- block; the first applicant from a town gets the base number itself.
-- Category blocks (2400 stragglers, 2500 elderly+disabled) are constants in
-- src/lib/pickup-numbers.ts. Run ONCE against the live DB with
-- `npm run db:migrate:remote`; tests get it via tests/helpers/d1.ts.
ALTER TABLE cities ADD COLUMN block_base INTEGER NOT NULL DEFAULT 0;
UPDATE cities SET block_base = 900  WHERE id = 1;
UPDATE cities SET block_base = 1000 WHERE id = 2;
UPDATE cities SET block_base = 1100 WHERE id = 3;
UPDATE cities SET block_base = 100  WHERE id = 4;
UPDATE cities SET block_base = 2100 WHERE id = 5;
UPDATE cities SET block_base = 1200 WHERE id = 6;
UPDATE cities SET block_base = 300  WHERE id = 7;
UPDATE cities SET block_base = 400  WHERE id = 8;
UPDATE cities SET block_base = 1600 WHERE id = 9;
UPDATE cities SET block_base = 1300 WHERE id = 10;
UPDATE cities SET block_base = 500  WHERE id = 11;
UPDATE cities SET block_base = 600  WHERE id = 12;
UPDATE cities SET block_base = 800  WHERE id = 13;
UPDATE cities SET block_base = 1700 WHERE id = 14;
UPDATE cities SET block_base = 1800 WHERE id = 15;
UPDATE cities SET block_base = 1900 WHERE id = 16;
UPDATE cities SET block_base = 200  WHERE id = 17;
UPDATE cities SET block_base = 1400 WHERE id = 18;
UPDATE cities SET block_base = 1500 WHERE id = 19;
UPDATE cities SET block_base = 700  WHERE id = 20;
UPDATE cities SET block_base = 2000 WHERE id = 22;
UPDATE cities SET block_base = 2200 WHERE id = 23;
UPDATE cities SET block_base = 2300 WHERE id = 24;
ALTER TABLE applications ADD COLUMN straggler INTEGER NOT NULL DEFAULT 0;
