-- Add new profile fields for equipment, skills, availability, and travel distance
ALTER TABLE public.profiles
ADD COLUMN equipment text[] DEFAULT ARRAY[]::text[],
ADD COLUMN skills text[] DEFAULT ARRAY[]::text[],
ADD COLUMN genres text[] DEFAULT ARRAY[]::text[],
ADD COLUMN availability_status text DEFAULT 'available',
ADD COLUMN travel_distance integer DEFAULT NULL,
ADD COLUMN years_experience integer DEFAULT NULL,
ADD COLUMN union_memberships text[] DEFAULT ARRAY[]::text[];

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.equipment IS 'List of instruments and gear the member uses';
COMMENT ON COLUMN public.profiles.skills IS 'Skills and abilities like sight-reading, improvisation';
COMMENT ON COLUMN public.profiles.genres IS 'Musical genres the member specializes in';
COMMENT ON COLUMN public.profiles.availability_status IS 'Current availability: available, busy, unavailable';
COMMENT ON COLUMN public.profiles.travel_distance IS 'Maximum miles willing to travel for gigs';
COMMENT ON COLUMN public.profiles.years_experience IS 'Years of professional experience';
COMMENT ON COLUMN public.profiles.union_memberships IS 'Union memberships like AFM, SAG';