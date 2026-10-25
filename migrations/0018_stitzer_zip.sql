-- Stitzer's zip was seeded as 53824 (that's Sinsinawa). Correct zip is 53825
-- (Sherlyn's town list, confirmed by Cody 2026-10-25). Mailing labels and
-- packing slips read the zip from this table, so this fixes every Stitzer label.
UPDATE cities SET zip = '53825' WHERE name = 'Stitzer';
