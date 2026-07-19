-- Town -> pickup-day links (2026-07-18 season-batch spec). NULLABLE ON
-- PURPOSE: unset means pickup slips print with no date, exactly as before.
-- The operator assigns days on the Pickup schedule screen; clearing them
-- turns the feature back off. Soft references (SQLite ALTER cannot add FKs):
-- a deleted pickup day simply stops matching.
ALTER TABLE cities ADD COLUMN pickup_day_id INTEGER;
ALTER TABLE settings ADD COLUMN straggler_pickup_day_id INTEGER;
