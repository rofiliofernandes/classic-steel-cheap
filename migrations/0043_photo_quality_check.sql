-- Automatic photo quality check (blur / too-small images are moved to Pending with a reason).
ALTER TABLE photos ADD COLUMN quality_checked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE photos ADD COLUMN quality_issue TEXT NOT NULL DEFAULT '';
