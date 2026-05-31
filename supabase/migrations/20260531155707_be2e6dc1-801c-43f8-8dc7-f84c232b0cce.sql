CREATE OR REPLACE FUNCTION public.get_public_performers()
RETURNS TABLE (
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
   AND ur.role IN (
     'entertainer'::public.app_role,
     'member'::public.app_role,
     'artist'::public.app_role,
     'band_member'::public.app_role
   )
  LEFT JOIN public.artist_profiles ap
    ON ap.user_id = p.id
  ORDER BY p.id, p.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_performers() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_performers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_performers() TO service_role;