-- Season revisions (2026-07-23 spec §1): Sherlyn verifies eligibility fully
-- by hand — the income-check feature is removed. DESTRUCTIVE: apply AFTER
-- the new code is deployed (the old code reads income_limits on every
-- admin applications screen and would 500).
-- applications.may_not_be_eligible is deliberately LEFT in place, inert
-- (NOT NULL DEFAULT 0): dropping it would break the still-deployed old
-- code's INSERTs during the migrate->deploy window.
DROP TABLE income_limits;
