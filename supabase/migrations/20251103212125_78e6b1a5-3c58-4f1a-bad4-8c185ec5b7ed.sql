-- Fix RLS policies causing permission errors by removing auth.users reference
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.band_invitations;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Ensure explicit policies per command for band leaders
DO $$ BEGIN
  DROP POLICY IF EXISTS "Band leaders can manage invitations" ON public.band_invitations;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Band leaders: SELECT
CREATE POLICY "Band leaders can view invitations"
ON public.band_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_invitations.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Band leaders: UPDATE
CREATE POLICY "Band leaders can update invitations"
ON public.band_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_invitations.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Band leaders: DELETE
CREATE POLICY "Band leaders can delete invitations"
ON public.band_invitations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_invitations.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Band leaders: INSERT (WITH CHECK is required)
CREATE POLICY "Band leaders can insert invitations"
ON public.band_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_invitations.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Anyone authenticated can view an invitation by token while it's pending and not expired
CREATE POLICY "Anyone can view band invitations by token"
ON public.band_invitations
FOR SELECT
TO authenticated
USING (
  status = 'pending' AND expires_at > now()
);

-- Invited user can accept (update) their own invitation by matching their profile email
CREATE POLICY "Invited user can accept their invitation"
ON public.band_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.email) = lower(band_invitations.email)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.email) = lower(band_invitations.email)
  )
);
