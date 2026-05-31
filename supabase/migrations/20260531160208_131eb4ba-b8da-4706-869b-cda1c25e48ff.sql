
-- 1) gig_members: scope reads to gig owner / member only
DROP POLICY IF EXISTS "Band members can view gig responses" ON public.gig_members;
CREATE POLICY "Gig participants can view gig responses"
ON public.gig_members
FOR SELECT
TO authenticated
USING (
  public.is_gig_member(gig_id, auth.uid())
  OR public.is_gig_owner(gig_id, auth.uid())
);

-- 2) member_availability: scope leader/booking-manager/tour-manager reads to shared band/tour
DROP POLICY IF EXISTS "Band leaders can view member availability" ON public.member_availability;
CREATE POLICY "Leaders can view availability of their members"
ON public.member_availability
FOR SELECT
TO authenticated
USING (
  -- band leader who shares a band with the member
  EXISTS (
    SELECT 1
    FROM public.bands b
    JOIN public.band_members bm ON bm.band_id = b.id
    WHERE b.band_leader_id = auth.uid()
      AND bm.member_id = member_availability.user_id
  )
  -- booking manager linked to a band the member belongs to
  OR EXISTS (
    SELECT 1
    FROM public.booking_manager_bands bmb
    JOIN public.band_members bm ON bm.band_id = bmb.band_id
    WHERE bmb.booking_manager_id = auth.uid()
      AND bm.member_id = member_availability.user_id
  )
  -- booking manager who directly manages this artist
  OR EXISTS (
    SELECT 1
    FROM public.booking_manager_artists bma
    WHERE bma.booking_manager_id = auth.uid()
      AND bma.artist_id = member_availability.user_id
  )
  -- tour manager who has this member on a tour crew
  OR EXISTS (
    SELECT 1
    FROM public.tours t
    JOIN public.tour_crew_members tcm ON tcm.tour_id = t.id
    WHERE t.tour_manager_id = auth.uid()
      AND tcm.crew_member_id = member_availability.user_id
  )
);

-- 3) message_reactions: restrict to authenticated users who can see the message
DROP POLICY IF EXISTS "Users can view message reactions" ON public.message_reactions;
CREATE POLICY "Participants can view message reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND (
        m.sender_id = auth.uid()
        OR m.recipient_id = auth.uid()
        OR (m.is_group_message = true AND public.users_share_band(m.sender_id, auth.uid()))
      )
  )
);

-- 4) notifications: only authenticated callers may insert, and only for themselves
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
-- service_role bypasses RLS, so edge functions / triggers using the service key still work.

-- 5) profiles: drop overly broad reads for band_leader & tour_manager, replace with scoped reads
DROP POLICY IF EXISTS "Band leaders can view all profiles for gig invites" ON public.profiles;
DROP POLICY IF EXISTS "Tour managers can view all profiles" ON public.profiles;

CREATE POLICY "Band leaders can view their own band/roster members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bands b
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE b.band_leader_id = auth.uid()
      AND (bm.member_id = profiles.id OR b.band_leader_id = profiles.id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.gigs g
    JOIN public.gig_members gm ON gm.gig_id = g.id
    WHERE g.user_id = auth.uid()
      AND gm.member_id = profiles.id
  )
);

CREATE POLICY "Tour managers can view their tour crew"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tours t
    JOIN public.tour_crew_members tcm ON tcm.tour_id = t.id
    WHERE t.tour_manager_id = auth.uid()
      AND (tcm.crew_member_id = profiles.id OR t.tour_manager_id = profiles.id)
  )
);

-- 6) rehearsals: scope reads to the band
DROP POLICY IF EXISTS "Band members can view rehearsals" ON public.rehearsals;
CREATE POLICY "Band-scoped rehearsal reads"
ON public.rehearsals
FOR SELECT
TO authenticated
USING (
  auth.uid() = band_leader_id
  OR (band_id IS NOT NULL AND public.is_band_member(band_id, auth.uid()))
  OR (band_id IS NOT NULL AND public.is_band_leader(band_id, auth.uid()))
);

-- 7) setlists: scope reads to the band
DROP POLICY IF EXISTS "Band members can view setlists" ON public.setlists;
CREATE POLICY "Band-scoped setlist reads"
ON public.setlists
FOR SELECT
TO authenticated
USING (
  auth.uid() = band_leader_id
  OR (band_id IS NOT NULL AND public.is_band_member(band_id, auth.uid()))
  OR (band_id IS NOT NULL AND public.is_band_leader(band_id, auth.uid()))
);
