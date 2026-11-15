-- Remove the low-resolution poster crops (/services/*.webp) from every service.
-- Cards then rotate your own uploaded images and project photos, or show an icon.
UPDATE services
SET images = (
  SELECT COALESCE(json_group_array(value), '[]')
  FROM json_each(CASE WHEN json_valid(services.images) THEN services.images ELSE '[]' END)
  WHERE value NOT LIKE '/services/%'
);
UPDATE services SET image_url = COALESCE(json_extract(images, '$[0]'), '') WHERE image_url LIKE '/services/%' OR image_url IS NULL;
