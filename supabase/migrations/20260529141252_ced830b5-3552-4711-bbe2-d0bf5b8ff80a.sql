-- 1. Backfill user_roles: map old → new, dedupe, then delete the old rows
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'booking_manager'::public.app_role
FROM public.user_roles
WHERE role IN ('band_leader'::public.app_role, 'venue_owner'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'entertainer'::public.app_role
FROM public.user_roles
WHERE role IN ('band_member'::public.app_role, 'artist'::public.app_role, 'tour_manager'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role IN (
  'band_leader'::public.app_role,
  'venue_owner'::public.app_role,
  'band_member'::public.app_role,
  'artist'::public.app_role,
  'tour_manager'::public.app_role
);

-- 2. Booking-manager-scoped admins table
CREATE TABLE IF NOT EXISTS public.booking_manager_admins (
  booking_manager_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_manager_id, admin_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_manager_admins TO authenticated;
GRANT ALL ON public.booking_manager_admins TO service_role;

ALTER TABLE public.booking_manager_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BM manages their admins" ON public.booking_manager_admins;
CREATE POLICY "BM manages their admins"
ON public.booking_manager_admins
FOR ALL
TO authenticated
USING (auth.uid() = booking_manager_id)
WITH CHECK (auth.uid() = booking_manager_id);

DROP POLICY IF EXISTS "Admin sees own links" ON public.booking_manager_admins;
CREATE POLICY "Admin sees own links"
ON public.booking_manager_admins
FOR SELECT
TO authenticated
USING (auth.uid() = admin_user_id);

CREATE INDEX IF NOT EXISTS idx_bma_admin ON public.booking_manager_admins(admin_user_id);

-- 3. New helper: is the given user an admin for the given booking manager?
CREATE OR REPLACE FUNCTION public.is_admin_for(_admin_id uuid, _booking_manager_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_manager_admins
    WHERE admin_user_id = _admin_id
      AND booking_manager_id = _booking_manager_id
  )
$$;

-- 4. New helper: does the user have an active entertainer subscription?
CREATE OR REPLACE FUNCTION public.is_entertainer_subscribed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entertainer_subscribers
    WHERE user_id = _user_id
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  )
$$;

-- 5. Backward-compatible has_role: maps legacy role names to their new equivalents
--    so existing RLS policies keep working without rewriting every one.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _normalized public.app_role;
BEGIN
  _normalized := CASE _role::text
    WHEN 'band_leader'  THEN 'booking_manager'::public.app_role
    WHEN 'venue_owner'  THEN 'booking_manager'::public.app_role
    WHEN 'band_member'  THEN 'entertainer'::public.app_role
    WHEN 'artist'       THEN 'entertainer'::public.app_role
    WHEN 'tour_manager' THEN 'entertainer'::public.app_role
    ELSE _role
  END;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _normalized
  );
END;
$$;

-- 6. get_user_role: only ever returns one of the 4 new values
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE role::text
      WHEN 'band_leader'  THEN 'booking_manager'::public.app_role
      WHEN 'venue_owner'  THEN 'booking_manager'::public.app_role
      WHEN 'band_member'  THEN 'entertainer'::public.app_role
      WHEN 'artist'       THEN 'entertainer'::public.app_role
      WHEN 'tour_manager' THEN 'entertainer'::public.app_role
      ELSE role
    END
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role::text
      WHEN 'super_admin' THEN 0
      WHEN 'booking_manager' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'entertainer' THEN 3
      ELSE 4
    END
  LIMIT 1
$$;

-- 7. handle_new_user: clamp incoming role to the 4 allowed values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _raw text;
  _final public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User')
  );

  _raw := COALESCE(NEW.raw_user_meta_data->>'role', '');
  _final := CASE _raw
    WHEN 'super_admin'     THEN 'super_admin'::public.app_role
    WHEN 'booking_manager' THEN 'booking_manager'::public.app_role
    WHEN 'admin'           THEN 'admin'::public.app_role
    WHEN 'entertainer'     THEN 'entertainer'::public.app_role
    -- legacy aliases
    WHEN 'band_leader'     THEN 'booking_manager'::public.app_role
    WHEN 'venue_owner'     THEN 'booking_manager'::public.app_role
    WHEN 'band_member'     THEN 'entertainer'::public.app_role
    WHEN 'artist'          THEN 'entertainer'::public.app_role
    WHEN 'tour_manager'    THEN 'entertainer'::public.app_role
    ELSE 'entertainer'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _final)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 8. Gate get_public_performers on active entertainer subscription
CREATE OR REPLACE FUNCTION public.get_public_performers()
RETURNS TABLE(user_id uuid, name text, bio text, photo_urls text[], genres text[], instrument text, years_experience integer, preferred_pay numeric, preferred_pay_hours numeric, performer_category text, stage_name text, genre text, availability text, rate_range text, youtube_videos jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (p.id)
    p.id AS user_id,
    p.name,
    p.bio,
    p.photo_urls,
    p.genres,
    p.instrument::text AS instrument,
    COALESCE(ap.years_experience, p.years_experience) AS years_experience,
    p.preferred_pay,
    p.preferred_pay_hours,
    p.performer_category,
    ap.stage_name,
    COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text) AS genre,
    COALESCE(ap.availability, p.availability_status) AS availability,
    ap.rate_range,
    COALESCE(ap.youtube_videos, '[]'::jsonb) AS youtube_videos
  FROM public.profiles p
  INNER JOIN public.user_roles ur
    ON ur.user_id = p.id
   AND ur.role = 'entertainer'::public.app_role
  INNER JOIN public.entertainer_subscribers es
    ON es.user_id = p.id
   AND es.status = 'active'
   AND (es.current_period_end IS NULL OR es.current_period_end > now())
  LEFT JOIN public.artist_profiles ap
    ON ap.user_id = p.id
  ORDER BY p.id, p.name;
$$;