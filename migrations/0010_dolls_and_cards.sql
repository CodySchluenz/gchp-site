-- Season revisions (2026-07-23 spec §3-§4): per-child doll choice + the
-- food/gift-card and Thanksgiving tracking Sherlyn keeps by hand today.
-- ADDITIVE: apply BEFORE deploying the code that reads these columns.
ALTER TABLE household_members ADD COLUMN doll TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN thanksgiving_card INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN food_card INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN food_card_amount REAL;
ALTER TABLE applications ADD COLUMN gift_card INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN gift_card_amount REAL;
