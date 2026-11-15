-- Fingerprint (SHA-256) of uploaded video files, used to refuse duplicate uploads.
ALTER TABLE videos ADD COLUMN content_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_videos_content_hash ON videos(content_hash);
