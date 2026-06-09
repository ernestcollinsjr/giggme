
-- Add new crew types (load handler, rigger) - enum additions can't run in same tx as use
ALTER TYPE public.crew_type ADD VALUE IF NOT EXISTS 'sound_tech';
ALTER TYPE public.crew_type ADD VALUE IF NOT EXISTS 'lighting_tech';
ALTER TYPE public.crew_type ADD VALUE IF NOT EXISTS 'band_member';
ALTER TYPE public.crew_type ADD VALUE IF NOT EXISTS 'load_handler';
ALTER TYPE public.crew_type ADD VALUE IF NOT EXISTS 'rigger';

-- Per-tour payment amount on crew membership
ALTER TABLE public.tour_crew_members
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;

-- Crew profile table (one per user) for reusable info across tours
CREATE TABLE IF NOT EXISTS public.crew_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_name TEXT,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  bio TEXT,
  photo_url TEXT,
  instruments TEXT[] DEFAULT ARRAY[]::TEXT[],
  vocal_range TEXT,
  gear_list TEXT,
  certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  years_experience INTEGER,
  console_experience TEXT,
  lighting_rig_experience TEXT,
  passport_number TEXT,
  passport_expiry DATE,
  tsa_precheck TEXT,
  dietary_needs TEXT,
  shirt_size TEXT,
  resume_url TEXT,
  demo_video_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  photo_gallery TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_profiles TO authenticated;
GRANT ALL ON public.crew_profiles TO service_role;

ALTER TABLE public.crew_profiles ENABLE ROW LEVEL SECURITY;

-- Owners manage their own profile
CREATE POLICY "Users can view their own crew profile"
  ON public.crew_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own crew profile"
  ON public.crew_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own crew profile"
  ON public.crew_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own crew profile"
  ON public.crew_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Tour managers can view + edit profiles of crew on their tours
CREATE POLICY "Tour managers can view crew profiles"
  ON public.crew_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tour_crew_members tcm
      JOIN public.tours t ON t.id = tcm.tour_id
      WHERE tcm.crew_member_id = crew_profiles.user_id
        AND t.tour_manager_id = auth.uid()
    )
  );

CREATE POLICY "Tour managers can update crew profiles"
  ON public.crew_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tour_crew_members tcm
      JOIN public.tours t ON t.id = tcm.tour_id
      WHERE tcm.crew_member_id = crew_profiles.user_id
        AND t.tour_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tour_crew_members tcm
      JOIN public.tours t ON t.id = tcm.tour_id
      WHERE tcm.crew_member_id = crew_profiles.user_id
        AND t.tour_manager_id = auth.uid()
    )
  );

CREATE POLICY "Tour managers can insert crew profiles"
  ON public.crew_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tour_crew_members tcm
      JOIN public.tours t ON t.id = tcm.tour_id
      WHERE tcm.crew_member_id = crew_profiles.user_id
        AND t.tour_manager_id = auth.uid()
    )
  );

CREATE TRIGGER update_crew_profiles_updated_at
  BEFORE UPDATE ON public.crew_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
