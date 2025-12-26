-- Add recipient_name column to band_invitations table
ALTER TABLE public.band_invitations 
ADD COLUMN recipient_name text;