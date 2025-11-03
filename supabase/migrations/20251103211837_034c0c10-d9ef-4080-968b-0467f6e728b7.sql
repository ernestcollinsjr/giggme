-- Remove the foreign key constraint on invited_by
ALTER TABLE public.band_invitations 
DROP CONSTRAINT IF EXISTS band_invitations_invited_by_fkey;

-- The invited_by column will still store the user ID but without the foreign key constraint
-- This is fine since we're only using it for audit purposes