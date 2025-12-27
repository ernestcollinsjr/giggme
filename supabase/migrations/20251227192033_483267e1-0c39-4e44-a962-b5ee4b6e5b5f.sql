-- Drop all existing band_members policies and recreate clean ones
DROP POLICY IF EXISTS "Band leaders can remove members" ON public.band_members;
DROP POLICY IF EXISTS "Leaders manage band members" ON public.band_members;
DROP POLICY IF EXISTS "Leaders view all band members" ON public.band_members;
DROP POLICY IF EXISTS "Members view own membership" ON public.band_members;

-- Create clean, non-recursive policies using security definer functions
-- Policy for band leaders to manage all operations
CREATE POLICY "Leaders manage band members"
ON public.band_members
FOR ALL
TO authenticated
USING (is_band_leader(band_id, auth.uid()))
WITH CHECK (is_band_leader(band_id, auth.uid()));

-- Policy for members to view their own membership
CREATE POLICY "Members view own membership"
ON public.band_members
FOR SELECT
TO authenticated
USING (member_id = auth.uid());