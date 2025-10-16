-- Change photo_url to support multiple photos (up to 3)
ALTER TABLE public.profiles 
DROP COLUMN photo_url;

ALTER TABLE public.profiles 
ADD COLUMN photo_urls text[] DEFAULT ARRAY[]::text[];