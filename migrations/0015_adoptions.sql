-- Adoptions (2026-07-27 docs/superpowers/specs/2026-07-27-adoptions-design.md):
-- Sherlyn marks an approved, consent-given family as adopted out to a
-- community organization or adoptive family. Additive. `adopted` here means
-- adopted-out-THIS-season (distinct from the existing `adopted_last_year`
-- column, which is the family's own answer on the application). Adopter
-- fields are kept even after clearAdoption unmarks a family, so re-marking
-- the same adopter is a one-click redo.
ALTER TABLE applications ADD COLUMN adopted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN adopter_name TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN adopter_contact TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN adopter_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN adopter_address TEXT NOT NULL DEFAULT '';
