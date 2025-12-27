-- Add accepted_at timestamp to band_invitations
ALTER TABLE public.band_invitations
ADD COLUMN accepted_at timestamp with time zone;