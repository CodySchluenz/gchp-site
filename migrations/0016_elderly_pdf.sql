-- Elderly/disabled paper application PDF (2026-07-29
-- docs/superpowers/specs/2026-07-29-elderly-application-design.md, "The
-- elderly paper application PDF"). Additive: a second upload slot next to
-- settings.pdf_uploaded_at, tracking when the elderly/disabled paper form
-- was last published, independent of the family paper form.
ALTER TABLE settings ADD COLUMN elderly_pdf_uploaded_at TEXT;
