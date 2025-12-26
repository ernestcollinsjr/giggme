-- Drop and recreate the policy that allows band leaders to view ALL invitations (including accepted)
DROP POLICY IF EXISTS "Band leaders can view invitations" ON public.band_invitations;

CREATE POLICY "Band leaders can view invitations" 
ON public.band_invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM bands 
    WHERE bands.id = band_invitations.band_id 
    AND bands.band_leader_id = auth.uid()
  )
);