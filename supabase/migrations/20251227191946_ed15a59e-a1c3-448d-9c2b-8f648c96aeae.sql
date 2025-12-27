-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Band members viewable by band leader and members" ON public.band_members;

-- The existing is_band_member and is_band_leader functions are security definer,
-- so the remaining policies should work without recursion.
-- Let's verify the SELECT policies are correct - we already have:
-- - "Leaders view all band members" using is_band_leader (security definer)
-- - "Members view own membership" checking member_id = auth.uid()
-- These should be sufficient and non-recursive.