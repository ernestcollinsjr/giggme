-- Fix 1: Restrict profiles table - users can only view profiles of people they work with
DROP POLICY IF EXISTS "Users can view all roles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view band member profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.band_members bm1
    JOIN public.band_members bm2 ON bm1.band_id = bm2.band_id
    WHERE bm1.member_id = auth.uid() AND bm2.member_id = profiles.id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.band_members bm ON b.id = bm.band_id
    WHERE (b.band_leader_id = auth.uid() AND bm.member_id = profiles.id)
       OR (b.band_leader_id = profiles.id AND bm.member_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.gig_members gm1
    JOIN public.gig_members gm2 ON gm1.gig_id = gm2.gig_id
    WHERE gm1.member_id = auth.uid() AND gm2.member_id = profiles.id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.tour_crew_members tc1
    JOIN public.tour_crew_members tc2 ON tc1.tour_id = tc2.tour_id
    WHERE tc1.crew_member_id = auth.uid() AND tc2.crew_member_id = profiles.id
  )
);

-- Fix 2: Restrict venues table - require authentication for full details
DROP POLICY IF EXISTS "Everyone can view venues" ON public.venues;

CREATE POLICY "Authenticated users can view venues"
ON public.venues
FOR SELECT
TO authenticated
USING (true);

-- Fix 3: Restrict gigs table - only show to involved parties
DROP POLICY IF EXISTS "Users can view all gigs" ON public.gigs;

CREATE POLICY "Users can view their own gigs"
ON public.gigs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Band members can view band gigs"
ON public.gigs
FOR SELECT
USING (
  band_id IS NOT NULL AND (
    is_band_leader(band_id, auth.uid()) OR
    is_band_member(band_id, auth.uid())
  )
);

CREATE POLICY "Gig members can view assigned gigs"
ON public.gigs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gig_members gm
    WHERE gm.gig_id = gigs.id AND gm.member_id = auth.uid()
  )
);