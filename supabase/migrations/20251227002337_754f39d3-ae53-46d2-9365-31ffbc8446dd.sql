-- First, drop ALL existing policies on band_members to start fresh
DROP POLICY IF EXISTS "Band leaders can manage their band members" ON public.band_members;
DROP POLICY IF EXISTS "Band leaders can add members" ON public.band_members;
DROP POLICY IF EXISTS "Band members can view their own membership" ON public.band_members;
DROP POLICY IF EXISTS "Members can view band membership" ON public.band_members;
DROP POLICY IF EXISTS "Band leaders can manage members" ON public.band_members;

-- Recreate the is_band_leader function (if not exists or needs update)
CREATE OR REPLACE FUNCTION public.is_band_leader(_band_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bands
    WHERE id = _band_id
      AND band_leader_id = _user_id
  )
$$;

-- Create simple, non-recursive policies

-- Policy 1: Band leaders can manage all members in their bands (using security definer function)
CREATE POLICY "Leaders manage band members"
ON public.band_members
FOR ALL
USING (public.is_band_leader(band_id, auth.uid()));

-- Policy 2: Users can view their own band membership
CREATE POLICY "Members view own membership"
ON public.band_members
FOR SELECT
USING (member_id = auth.uid());

-- Policy 3: Band leaders can view all members (using security definer function) 
CREATE POLICY "Leaders view all band members"
ON public.band_members
FOR SELECT
USING (public.is_band_leader(band_id, auth.uid()));