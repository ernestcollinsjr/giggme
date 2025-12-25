-- Add social media and YouTube links columns to bands table
ALTER TABLE public.bands
ADD COLUMN social_links jsonb DEFAULT '{}'::jsonb,
ADD COLUMN youtube_links text[] DEFAULT ARRAY[]::text[];