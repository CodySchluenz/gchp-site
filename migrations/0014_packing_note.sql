-- Typed packing note (2026-07-26 Addendum 3 to docs/superpowers/specs/
-- 2026-07-26-packing-slip-content-design.md): Sherlyn types it once instead
-- of handwriting on the printed slip. Volunteer-visible by design and by
-- label — distinct from admin_notes, which stays private. Additive.
ALTER TABLE applications ADD COLUMN packing_note TEXT NOT NULL DEFAULT '';
