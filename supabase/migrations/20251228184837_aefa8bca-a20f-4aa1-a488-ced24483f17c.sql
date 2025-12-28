
-- Create security definer function to check if user owns a gig (breaks RLS recursion)
CREATE OR REPLACE FUNCTION public.is_gig_owner(_gig_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gigs
    WHERE id = _gig_id
      AND user_id = _user_id
  )
$$;

-- Create security definer function to check if user is a gig member
CREATE OR REPLACE FUNCTION public.is_gig_member(_gig_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gig_members
    WHERE gig_id = _gig_id
      AND member_id = _user_id
  )
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Band leaders can manage gig members" ON public.gig_members;
DROP POLICY IF EXISTS "Gig members can view assigned gigs" ON public.gigs;

-- Recreate policies using security definer functions
CREATE POLICY "Band leaders can manage gig members"
ON public.gig_members
FOR ALL
USING (is_gig_owner(gig_id, auth.uid()));

CREATE POLICY "Gig members can view assigned gigs"
ON public.gigs
FOR SELECT
USING (is_gig_member(id, auth.uid()));
