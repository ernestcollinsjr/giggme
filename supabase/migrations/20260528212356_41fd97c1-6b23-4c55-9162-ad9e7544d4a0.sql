
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can view all profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Booking managers can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can view all user roles' AND tablename = 'user_roles') THEN
    CREATE POLICY "Booking managers can view all user roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can view all bands' AND tablename = 'bands') THEN
    CREATE POLICY "Booking managers can view all bands" ON public.bands FOR SELECT USING (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can view all band members' AND tablename = 'band_members') THEN
    CREATE POLICY "Booking managers can view all band members" ON public.band_members FOR SELECT USING (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Booking managers can view entertainer subscribers' AND tablename = 'entertainer_subscribers') THEN
    CREATE POLICY "Booking managers can view entertainer subscribers" ON public.entertainer_subscribers FOR SELECT USING (public.has_role(auth.uid(), 'booking_manager'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can view entertainer subscribers' AND tablename = 'entertainer_subscribers') THEN
    CREATE POLICY "Super admins can view entertainer subscribers" ON public.entertainer_subscribers FOR SELECT USING (public.is_super_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can view all bands' AND tablename = 'bands') THEN
    CREATE POLICY "Super admins can view all bands" ON public.bands FOR SELECT USING (public.is_super_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can view all band members' AND tablename = 'band_members') THEN
    CREATE POLICY "Super admins can view all band members" ON public.band_members FOR SELECT USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;
