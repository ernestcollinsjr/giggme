-- Allow band leaders to view profiles of members they're inviting to gigs
CREATE POLICY "Band leaders can view all profiles for gig invites"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'band_leader'
  )
);