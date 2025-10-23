-- Fix profiles table RLS - restrict public access to personal information
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Add owner-only policy
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Add policy for band members to view each other's profiles
-- Users can view profiles of other members in their bands
CREATE POLICY "Band members can view each other"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gig_members gm1
    INNER JOIN public.gig_members gm2 ON gm1.gig_id = gm2.gig_id
    WHERE gm1.member_id = auth.uid()
    AND gm2.member_id = profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.bands
    WHERE band_leader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.gig_members
      WHERE member_id = profiles.id
    )
  )
);