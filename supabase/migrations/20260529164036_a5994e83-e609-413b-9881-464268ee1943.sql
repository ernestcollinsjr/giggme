CREATE OR REPLACE FUNCTION public.accept_band_invitation(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _inv public.band_invitations%ROWTYPE;
  _band_leader uuid;
  _role public.app_role;
  _band_name text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _inv FROM public.band_invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF _inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  _role := CASE _inv.role
    WHEN 'admin' THEN 'admin'::public.app_role
    WHEN 'entertainer' THEN 'entertainer'::public.app_role
    ELSE 'member'::public.app_role
  END;

  UPDATE public.band_invitations
    SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
    WHERE id = _inv.id;

  SELECT band_leader_id, name INTO _band_leader, _band_name
    FROM public.bands WHERE id = _inv.band_id;

  DELETE FROM public.user_roles WHERE user_id = _uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role)
    ON CONFLICT (user_id, role) DO NOTHING;

  IF _role <> 'admin' THEN
    INSERT INTO public.band_members (band_id, member_id)
      VALUES (_inv.band_id, _uid)
      ON CONFLICT DO NOTHING;
  END IF;

  IF _role = 'admin' AND _band_leader IS NOT NULL THEN
    INSERT INTO public.booking_manager_admins (booking_manager_id, admin_user_id)
      VALUES (_band_leader, _uid)
      ON CONFLICT (booking_manager_id, admin_user_id) DO NOTHING;
  END IF;

  -- Ensure profile exists (in case handle_new_user trigger missed it)
  INSERT INTO public.profiles (id, email, name, band_name)
  VALUES (
    _uid,
    LOWER(_inv.email),
    COALESCE(NULLIF(_inv.recipient_name, ''), 'New User'),
    _band_name
  )
  ON CONFLICT (id) DO NOTHING;

  -- Backfill name from invitation if profile name is empty or default
  UPDATE public.profiles
    SET name = _inv.recipient_name
    WHERE id = _uid
      AND _inv.recipient_name IS NOT NULL
      AND _inv.recipient_name <> ''
      AND (name IS NULL OR name = '' OR name = 'New User');

  -- Backfill band_name if empty
  UPDATE public.profiles
    SET band_name = _band_name
    WHERE id = _uid
      AND (band_name IS NULL OR band_name = '')
      AND _band_name IS NOT NULL;

  RETURN jsonb_build_object(
    'band_id', _inv.band_id,
    'band_name', _band_name,
    'role', _role
  );
END;
$function$;