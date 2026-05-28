
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can update all profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Booking managers can update all profiles"
      ON public.profiles FOR UPDATE
      USING (public.has_role(auth.uid(), 'booking_manager'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can manage user roles' AND tablename = 'user_roles') THEN
    CREATE POLICY "Booking managers can manage user roles"
      ON public.user_roles FOR ALL
      USING (public.has_role(auth.uid(), 'booking_manager'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can manage band members' AND tablename = 'band_members') THEN
    CREATE POLICY "Booking managers can manage band members"
      ON public.band_members FOR ALL
      USING (public.has_role(auth.uid(), 'booking_manager'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;
END $$;
