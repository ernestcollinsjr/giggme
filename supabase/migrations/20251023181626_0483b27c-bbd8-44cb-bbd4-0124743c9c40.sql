-- Add crew_type to tour_invitations table
ALTER TABLE public.tour_invitations
ADD COLUMN crew_type public.crew_type NOT NULL DEFAULT 'band_members';