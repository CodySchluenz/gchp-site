-- Per-family pickup day (Sherlyn 2026-07-31): big towns like Boscobel and
-- Platteville pick up across MULTIPLE days, so the coordinator can pick a
-- specific day on any application. NULL = the usual rule (town's day;
-- straggler day for stragglers).
ALTER TABLE applications ADD COLUMN pickup_day_override_id INTEGER;
