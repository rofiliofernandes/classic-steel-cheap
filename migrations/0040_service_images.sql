-- Each service/category can have several images that rotate on the homepage card.
ALTER TABLE services ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
ALTER TABLE services ADD COLUMN include_projects INTEGER NOT NULL DEFAULT 1;
UPDATE services SET images = json_array(image_url) WHERE image_url IS NOT NULL AND image_url <> '';
