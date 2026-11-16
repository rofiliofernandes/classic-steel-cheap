-- Project photos an admin has hidden from a specific service card (JSON array of image URLs).
ALTER TABLE services ADD COLUMN hidden_photos TEXT NOT NULL DEFAULT '[]';
