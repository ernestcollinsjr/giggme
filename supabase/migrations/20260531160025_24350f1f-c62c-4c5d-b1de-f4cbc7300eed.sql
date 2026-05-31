
CREATE OR REPLACE FUNCTION public.get_my_performers()
RETURNS TABLE(
  user_id uuid,
  name text,
  bio text,
  photo_urls text[],
  genres text[],
  instrument text,
  years_experience integer,
  preferred_pay numeric,
  preferred_pay_hours numeric,
  performer_category text,
  stage_name text,
  genre text,
  availability text,
  rate_range text,
  youtube_videos jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bm_id uuid;
  _is_bm boolean := false;
  _is_admin boolean := false;
  _is_super boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _is_super := public.is_super_admin(_uid);
  _is_bm := public.has_role(_uid, 'booking_manager'::public.app_role);
  _is_admin := public.has_role(_uid, 'admin'::public.app_role);

  -- Super admins see all
  IF _is_super THEN
    RETURN QUERY SELECT * FROM public.get_public_performers();
    RETURN;
  END IF;

  -- Booking managers / admins linked to a BM: only their own performers
  IF _is_bm OR _is_admin THEN
    IF _is_bm THEN
      _bm_id := _uid;
    ELSE
      SELECT bma.booking_manager_id INTO _bm_id
      FROM public.booking_manager_admins bma
      WHERE bma.admin_user_id = _uid
      LIMIT 1;
    END IF;

    IF _bm_id IS NULL THEN
      RETURN;
    END IF;

    RETURN QUERY
    WITH owned AS (
      SELECT bma.artist_id AS uid
      FROM public.booking_manager_artists bma
      WHERE bma.booking_manager_id = _bm_id
      UNION
      SELECT bm.member_id AS uid
      FROM public.booking_manager_bands bmb
      JOIN public.band_members bm ON bm.band_id = bmb.band_id
      WHERE bmb.booking_manager_id = _bm_id
      UNION
      SELECT b.band_leader_id AS uid
      FROM public.booking_manager_bands bmb
      JOIN public.bands b ON b.id = bmb.band_id
      WHERE bmb.booking_manager_id = _bm_id
      UNION
      -- Bands the BM leads themselves
      SELECT bm.member_id
      FROM public.bands b
      JOIN public.band_members bm ON bm.band_id = b.id
      WHERE b.band_leader_id = _bm_id
    )
    SELECT DISTINCT ON (p.id)
      p.id,
      p.name,
      p.bio,
      p.photo_urls,
      p.genres,
      p.instrument::text,
      COALESCE(ap.years_experience, p.years_experience),
      p.preferred_pay,
      p.preferred_pay_hours,
      p.performer_category,
      ap.stage_name,
      COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text),
      COALESCE(ap.availability, p.availability_status),
      ap.rate_range,
      COALESCE(ap.youtube_videos, '[]'::jsonb)
    FROM owned o
    JOIN public.profiles p ON p.id = o.uid
    LEFT JOIN public.artist_profiles ap ON ap.user_id = p.id
    ORDER BY p.id, p.name;
    RETURN;
  END IF;

  -- All other roles: public list
  RETURN QUERY SELECT * FROM public.get_public_performers();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_performers() TO authenticated, anon, service_role;
