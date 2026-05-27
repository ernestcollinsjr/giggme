
-- 1. artist_profiles: drop unused, publicly-readable payment_methods column
ALTER TABLE public.artist_profiles DROP COLUMN IF EXISTS payment_methods;

-- 2. band_invitations: remove public-by-token read policy
DROP POLICY IF EXISTS "Anyone can view band invitations by token" ON public.band_invitations;
CREATE POLICY "Invited user can view their invitation"
ON public.band_invitations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.email) = lower(band_invitations.email)
  )
);

-- 3. tour_invitations: remove public-by-token read policy
DROP POLICY IF EXISTS "Anyone can view invitations by token" ON public.tour_invitations;
CREATE POLICY "Invited user can view their tour invitation"
ON public.tour_invitations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.email) = lower(tour_invitations.email)
  )
);

-- 4. email_tracking: remove blanket public ALL policy (service_role bypasses RLS)
DROP POLICY IF EXISTS "System can manage email tracking" ON public.email_tracking;

-- 5. messages: restrict group message access via band membership
CREATE OR REPLACE FUNCTION public.users_share_band(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members bm1
    JOIN public.band_members bm2 ON bm1.band_id = bm2.band_id
    WHERE bm1.member_id = _a AND bm2.member_id = _b
  )
  OR EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.band_members bm ON bm.band_id = b.id
    WHERE (b.band_leader_id = _a AND bm.member_id = _b)
       OR (b.band_leader_id = _b AND bm.member_id = _a)
  )
  OR EXISTS (
    SELECT 1 FROM public.bands b
    WHERE b.band_leader_id = _a AND b.band_leader_id = _b
  );
$$;

DROP POLICY IF EXISTS "Users can view relevant messages" ON public.messages;
CREATE POLICY "Users can view relevant messages"
ON public.messages FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR (is_group_message = true AND public.users_share_band(sender_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can update message read status" ON public.messages;
CREATE POLICY "Users can update message read status"
ON public.messages FOR UPDATE TO authenticated
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR (is_group_message = true AND public.users_share_band(sender_id, auth.uid()))
);

-- 6. performer_ratings: require authentication to submit
DROP POLICY IF EXISTS "Anyone can submit ratings" ON public.performer_ratings;
CREATE POLICY "Authenticated users can submit ratings"
ON public.performer_ratings FOR INSERT TO authenticated
WITH CHECK (true);

-- 7. setlist_songs: restrict reads to actual band leader/members of the setlist's band
DROP POLICY IF EXISTS "Band members can view setlist songs" ON public.setlist_songs;
CREATE POLICY "Band members can view setlist songs"
ON public.setlist_songs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id
      AND (
        s.band_leader_id = auth.uid()
        OR (s.band_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.band_members bm
          WHERE bm.band_id = s.band_id AND bm.member_id = auth.uid()
        ))
      )
  )
);

-- 8. user_roles: remove self role-assignment privilege escalation
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;
