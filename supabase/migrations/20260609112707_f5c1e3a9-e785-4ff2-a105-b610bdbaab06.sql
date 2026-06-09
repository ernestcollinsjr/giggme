
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instrument_custom text,
  ADD COLUMN IF NOT EXISTS is_singer boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_public_performers() CASCADE;
DROP FUNCTION IF EXISTS public.get_featured_entertainers() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_performers() CASCADE;

CREATE OR REPLACE FUNCTION public.get_public_performers()
 RETURNS TABLE(user_id uuid, name text, bio text, photo_urls text[], genres text[], instrument text, instrument_custom text, is_singer boolean, years_experience integer, preferred_pay numeric, preferred_pay_hours numeric, performer_category text, stage_name text, genre text, availability text, rate_range text, youtube_videos jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (p.id)
    p.id AS user_id, p.name, p.bio, p.photo_urls, p.genres,
    p.instrument::text AS instrument,
    p.instrument_custom,
    COALESCE(p.is_singer, false) AS is_singer,
    COALESCE(ap.years_experience, p.years_experience) AS years_experience,
    p.preferred_pay, p.preferred_pay_hours, p.performer_category,
    ap.stage_name,
    COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text) AS genre,
    COALESCE(ap.availability, p.availability_status) AS availability,
    ap.rate_range,
    COALESCE(ap.youtube_videos, '[]'::jsonb) AS youtube_videos
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
   AND ur.role IN ('entertainer'::public.app_role,'member'::public.app_role,'artist'::public.app_role,'band_member'::public.app_role)
  LEFT JOIN public.artist_profiles ap ON ap.user_id = p.id
  ORDER BY p.id, p.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_featured_entertainers()
 RETURNS TABLE(user_id uuid, name text, bio text, photo_urls text[], performer_category text, stage_name text, genre text, instrument text, instrument_custom text, is_singer boolean, entertainer_categories text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id AS user_id, p.name, p.bio, p.photo_urls, p.performer_category,
    ap.stage_name,
    COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text) AS genre,
    p.instrument::text AS instrument,
    p.instrument_custom,
    COALESCE(p.is_singer, false) AS is_singer,
    COALESCE(p.entertainer_categories, ARRAY[]::text[]) AS entertainer_categories
  FROM public.entertainer_subscribers es
  JOIN public.profiles p ON p.id = es.user_id
  LEFT JOIN public.artist_profiles ap ON ap.user_id = p.id
  WHERE es.status = 'active'
    AND (es.current_period_end IS NULL OR es.current_period_end > now())
  ORDER BY p.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_performers()
 RETURNS TABLE(user_id uuid, name text, bio text, photo_urls text[], genres text[], instrument text, instrument_custom text, is_singer boolean, years_experience integer, preferred_pay numeric, preferred_pay_hours numeric, performer_category text, stage_name text, genre text, availability text, rate_range text, youtube_videos jsonb, is_pending boolean, email text, expires_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _bm_id uuid;
  _is_bm boolean := false;
  _is_admin boolean := false;
  _is_super boolean := false;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  _is_super := public.is_super_admin(_uid);
  _is_bm := public.has_role(_uid, 'booking_manager'::public.app_role);
  _is_admin := public.has_role(_uid, 'admin'::public.app_role);

  IF _is_super THEN
    RETURN QUERY
      SELECT p.user_id, p.name, p.bio, p.photo_urls, p.genres, p.instrument, p.instrument_custom, p.is_singer,
        p.years_experience, p.preferred_pay, p.preferred_pay_hours, p.performer_category, p.stage_name, p.genre,
        p.availability, p.rate_range, p.youtube_videos, false AS is_pending, pr.email,
        NULL::timestamp with time zone AS expires_at
      FROM public.get_public_performers() p
      LEFT JOIN public.profiles pr ON pr.id = p.user_id;
    RETURN;
  END IF;

  IF _is_bm OR _is_admin THEN
    IF _is_bm THEN _bm_id := _uid;
    ELSE
      SELECT bma.booking_manager_id INTO _bm_id FROM public.booking_manager_admins bma
        WHERE bma.admin_user_id = _uid LIMIT 1;
    END IF;
    IF _bm_id IS NULL THEN RETURN; END IF;

    RETURN QUERY
    WITH owned AS (
      SELECT bma.artist_id AS uid FROM public.booking_manager_artists bma WHERE bma.booking_manager_id = _bm_id
      UNION
      SELECT bm.member_id FROM public.booking_manager_bands bmb JOIN public.band_members bm ON bm.band_id = bmb.band_id WHERE bmb.booking_manager_id = _bm_id
      UNION
      SELECT b.band_leader_id FROM public.booking_manager_bands bmb JOIN public.bands b ON b.id = bmb.band_id WHERE bmb.booking_manager_id = _bm_id
      UNION
      SELECT bm.member_id FROM public.bands b JOIN public.band_members bm ON bm.band_id = b.id WHERE b.band_leader_id = _bm_id
    ),
    accepted AS (
      SELECT DISTINCT ON (p.id)
        p.id AS user_id, p.name, p.bio, p.photo_urls, p.genres,
        p.instrument::text AS instrument, p.instrument_custom, COALESCE(p.is_singer,false) AS is_singer,
        COALESCE(ap.years_experience, p.years_experience) AS years_experience,
        p.preferred_pay, p.preferred_pay_hours, p.performer_category,
        ap.stage_name, COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text) AS genre,
        COALESCE(ap.availability, p.availability_status) AS availability,
        ap.rate_range, COALESCE(ap.youtube_videos, '[]'::jsonb) AS youtube_videos,
        false AS is_pending, p.email, NULL::timestamp with time zone AS expires_at
      FROM owned o JOIN public.profiles p ON p.id = o.uid
      LEFT JOIN public.artist_profiles ap ON ap.user_id = p.id
      ORDER BY p.id, p.name
    ),
    pending AS (
      SELECT DISTINCT ON (LOWER(bi.email))
        bi.id AS user_id, COALESCE(NULLIF(bi.recipient_name, ''), bi.email) AS name,
        NULL::text AS bio, ARRAY[]::text[] AS photo_urls, ARRAY[]::text[] AS genres,
        NULL::text AS instrument, NULL::text AS instrument_custom, false AS is_singer,
        NULL::integer AS years_experience, NULL::numeric AS preferred_pay, NULL::numeric AS preferred_pay_hours,
        bi.performer_category, NULL::text AS stage_name, NULL::text AS genre, NULL::text AS availability,
        NULL::text AS rate_range, '[]'::jsonb AS youtube_videos,
        true AS is_pending, bi.email, bi.expires_at
      FROM public.band_invitations bi
      JOIN public.bands b ON b.id = bi.band_id
      WHERE bi.status = 'pending' AND bi.expires_at > now()
        AND (b.band_leader_id = _bm_id OR EXISTS (
          SELECT 1 FROM public.booking_manager_bands bmb WHERE bmb.booking_manager_id = _bm_id AND bmb.band_id = b.id))
        AND LOWER(bi.email) NOT IN (SELECT LOWER(p2.email) FROM accepted a JOIN public.profiles p2 ON p2.id = a.user_id WHERE p2.email IS NOT NULL)
      ORDER BY LOWER(bi.email), bi.created_at DESC
    )
    SELECT * FROM accepted UNION ALL SELECT * FROM pending;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.user_id, p.name, p.bio, p.photo_urls, p.genres, p.instrument, p.instrument_custom, p.is_singer,
      p.years_experience, p.preferred_pay, p.preferred_pay_hours, p.performer_category, p.stage_name, p.genre,
      p.availability, p.rate_range, p.youtube_videos, false AS is_pending, pr.email,
      NULL::timestamp with time zone AS expires_at
    FROM public.get_public_performers() p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id;
END;
$function$;
