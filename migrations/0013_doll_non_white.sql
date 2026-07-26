-- Terminology update (owner request 2026-07-25): the doll choice is
-- White / Non-White. Renames the stored value; idempotent; data-only.
UPDATE household_members SET doll = 'non_white' WHERE doll = 'black';
