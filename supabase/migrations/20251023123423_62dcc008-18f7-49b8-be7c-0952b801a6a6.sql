-- Add 'artist' role to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'artist';

-- Create artist_profiles table for artist-specific information
CREATE TABLE IF NOT EXISTS public.artist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_name TEXT,
  genre TEXT,
  years_experience INTEGER,
  availability TEXT,
  rate_range TEXT,
  youtube_videos JSONB DEFAULT '[]'::jsonb,
  social_links JSONB DEFAULT '{}'::jsonb,
  achievements TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

-- Artists can manage their own profiles
CREATE POLICY "Artists can manage their own profile"
  ON public.artist_profiles
  FOR ALL
  USING (auth.uid() = user_id);

-- Everyone can view artist profiles (for discovery)
CREATE POLICY "Anyone can view artist profiles"
  ON public.artist_profiles
  FOR SELECT
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();