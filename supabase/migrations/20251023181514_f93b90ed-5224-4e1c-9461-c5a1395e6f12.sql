-- Add crew_type enum and column to tour_crew_members
CREATE TYPE public.crew_type AS ENUM ('band_members', 'singer', 'sound_crew', 'lighting_crew');

ALTER TABLE public.tour_crew_members
ADD COLUMN crew_type public.crew_type NOT NULL DEFAULT 'band_members';