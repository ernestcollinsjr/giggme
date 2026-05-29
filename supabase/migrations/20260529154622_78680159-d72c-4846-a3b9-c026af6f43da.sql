
-- 1) Server-side accept function that bypasses RLS safely.
CREATE OR REPLACE FUNCTION public.accept_band_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Normalize role
  _role := CASE _inv.role
    WHEN 'admin' THEN 'admin'::public.app_role
    WHEN 'entertainer' THEN 'entertainer'::public.app_role
    ELSE 'member'::public.app_role
  END;

  -- Mark invitation accepted (idempotent)
  UPDATE public.band_invitations
    SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
    WHERE id = _inv.id;

  -- Get band leader & name
  SELECT band_leader_id, name INTO _band_leader, _band_name
    FROM public.bands WHERE id = _inv.band_id;

  -- Replace user's roles with the assigned role
  DELETE FROM public.user_roles WHERE user_id = _uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role)
    ON CONFLICT (user_id, role) DO NOTHING;

  -- Add to band_members (non-admin invitees)
  IF _role <> 'admin' THEN
    INSERT INTO public.band_members (band_id, member_id)
      VALUES (_inv.band_id, _uid)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Admins: link to the booking manager
  IF _role = 'admin' AND _band_leader IS NOT NULL THEN
    INSERT INTO public.booking_manager_admins (booking_manager_id, admin_user_id)
      VALUES (_band_leader, _uid)
      ON CONFLICT (booking_manager_id, admin_user_id) DO NOTHING;
  END IF;

  -- Auto-fill band_name on profile if empty
  UPDATE public.profiles
    SET band_name = _band_name
    WHERE id = _uid AND (band_name IS NULL OR band_name = '') AND _band_name IS NOT NULL;

  RETURN jsonb_build_object(
    'band_id', _inv.band_id,
    'band_name', _band_name,
    'role', _role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_band_invitation(uuid) TO authenticated;

-- 2) Repair Ernest Collins' account (invitation was marked accepted but role/membership never landed)
DO $$
DECLARE
  _uid uuid;
  _band_id uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'ernestcollinsjr@gmail.com';
  SELECT band_id INTO _band_id FROM public.band_invitations
    WHERE email = 'ernestcollinsjr@gmail.com' AND status = 'accepted'
    ORDER BY accepted_at DESC LIMIT 1;

  IF _uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _uid;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'member'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    IF _band_id IS NOT NULL THEN
      INSERT INTO public.band_members (band_id, member_id) VALUES (_band_id, _uid)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
