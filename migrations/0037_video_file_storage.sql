-- Videos are stored as real files in R2 (manual uploads and downloaded Instagram videos).
ALTER TABLE videos ADD COLUMN bytes INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN file_bytes INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN download_error TEXT DEFAULT '';
ALTER TABLE videos ADD COLUMN download_attempts INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_videos_platform_media ON videos(platform, media_url);
