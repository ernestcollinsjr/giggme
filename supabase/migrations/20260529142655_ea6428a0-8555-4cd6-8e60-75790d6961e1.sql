-- Backfill: convert entertainers without active subscription -> member
UPDATE public.user_roles ur
SET role = 'member'::public.app_role
WHERE ur.role = 'entertainer'::public.app_role
  AND NOT EXISTS (
    SELECT 1 FROM public.entertainer_subscribers es
    WHERE es.user_id = ur.user_id
      AND es.status = 'active'
      AND (es.current_period_end IS NULL OR es.current_period_end > now())
  );

-- has_role: keep legacy aliases; do not auto-map member <-> entertainer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _normalized public.app_role;
BEGIN
  _normalized := CASE _role::text
    WHEN 'band_leader'  THEN 'booking_manager'::public.app_role
    WHEN 'venue_owner'  THEN 'booking_manager'::public.app_role
    WHEN 'band_member'  THEN 'member'::public.app_role
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
$function$;

-- get_user_role: return primary role with member ranked just below entertainer
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE role::text
      WHEN 'band_leader'  THEN 'booking_manager'::public.app_role
      WHEN 'venue_owner'  THEN 'booking_manager'::public.app_role
      WHEN 'band_member'  THEN 'member'::public.app_role
      WHEN 'artist'       THEN 'entertainer'::public.app_role
      WHEN 'tour_manager' THEN 'entertainer'::public.app_role
      ELSE role
    END
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role::text
      WHEN 'super_admin'     THEN 0
      WHEN 'booking_manager' THEN 1
      WHEN 'admin'           THEN 2
      WHEN 'entertainer'     THEN 3
      WHEN 'member'          THEN 4
      ELSE 5
    END
  LIMIT 1
$function$;

-- handle_new_user: accept 'member' as a valid value
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    WHEN 'member'          THEN 'member'::public.app_role
    -- legacy aliases
    WHEN 'band_leader'     THEN 'booking_manager'::public.app_role
    WHEN 'venue_owner'     THEN 'booking_manager'::public.app_role
    WHEN 'band_member'     THEN 'member'::public.app_role
    WHEN 'artist'          THEN 'entertainer'::public.app_role
    WHEN 'tour_manager'    THEN 'entertainer'::public.app_role
    ELSE 'member'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _final)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;