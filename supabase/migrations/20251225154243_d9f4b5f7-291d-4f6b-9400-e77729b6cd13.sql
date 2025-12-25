-- Add social media and YouTube links columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS youtube_links text[] DEFAULT ARRAY[]::text[];