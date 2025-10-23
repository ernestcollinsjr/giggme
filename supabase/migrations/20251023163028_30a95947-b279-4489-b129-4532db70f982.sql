-- Helper functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_tour_manager(_tour_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tours t
    WHERE t.id = _tour_id AND t.tour_manager_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_tour(_tour_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tour_crew_members c
    WHERE c.tour_id = _tour_id AND c.crew_member_id = _user_id
  );
$$;

-- Drop existing policies to replace with non-recursive versions
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tours' AND policyname='Tour managers can manage their tours')
  THEN EXECUTE 'DROP POLICY "Tour managers can manage their tours" ON public.tours'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tours' AND policyname='Tour crew can view their tours')
  THEN EXECUTE 'DROP POLICY "Tour crew can view their tours" ON public.tours'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tours' AND policyname='Crew can view assigned tours')
  THEN EXECUTE 'DROP POLICY "Crew can view assigned tours" ON public.tours'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tour_crew_members' AND policyname='Tour managers can manage their tour crew')
  THEN EXECUTE 'DROP POLICY "Tour managers can manage their tour crew" ON public.tour_crew_members'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tour_crew_members' AND policyname='Tour managers manage crew')
  THEN EXECUTE 'DROP POLICY "Tour managers manage crew" ON public.tour_crew_members'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tour_crew_members' AND policyname='Crew members can manage their responses')
  THEN EXECUTE 'DROP POLICY "Crew members can manage their responses" ON public.tour_crew_members'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tour_crew_members' AND policyname='Crew members view own responses')
  THEN EXECUTE 'DROP POLICY "Crew members view own responses" ON public.tour_crew_members'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tour_crew_members' AND policyname='Crew members update own responses')
  THEN EXECUTE 'DROP POLICY "Crew members update own responses" ON public.tour_crew_members'; END IF;
END $$;

-- Non-recursive policies
CREATE POLICY "Tour managers can manage their tours"
ON public.tours
FOR ALL
TO authenticated
USING (auth.uid() = tour_manager_id)
WITH CHECK (auth.uid() = tour_manager_id);

CREATE POLICY "Crew can view assigned tours"
ON public.tours
FOR SELECT
TO authenticated
USING (public.is_assigned_to_tour(id, auth.uid()));

CREATE POLICY "Tour managers manage crew"
ON public.tour_crew_members
FOR ALL
TO authenticated
USING (public.is_tour_manager(tour_id, auth.uid()))
WITH CHECK (public.is_tour_manager(tour_id, auth.uid()));

CREATE POLICY "Crew members view own responses"
ON public.tour_crew_members
FOR SELECT
TO authenticated
USING (auth.uid() = crew_member_id);

CREATE POLICY "Crew members update own responses"
ON public.tour_crew_members
FOR UPDATE
TO authenticated
USING (auth.uid() = crew_member_id)
WITH CHECK (auth.uid() = crew_member_id);