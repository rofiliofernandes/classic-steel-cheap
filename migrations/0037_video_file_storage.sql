-- Video file columns (bytes, file_bytes, download_error, download_attempts) are added by the Worker at
-- runtime (ensureVideoFileColumns), so this migration is safe on databases where some already exist.
CREATE INDEX IF NOT EXISTS idx_videos_platform_media ON videos(platform, media_url);
