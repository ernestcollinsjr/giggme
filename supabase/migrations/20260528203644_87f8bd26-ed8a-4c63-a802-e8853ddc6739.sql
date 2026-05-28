DROP FUNCTION IF EXISTS public.get_featured_entertainers();
CREATE OR REPLACE FUNCTION public.get_featured_entertainers()
 RETURNS TABLE(user_id uuid, name text, bio text, photo_urls text[], performer_category text, stage_name text, genre text, instrument text, entertainer_categories text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id AS user_id,
    p.name,
    p.bio,
    p.photo_urls,
    p.performer_category,
    ap.stage_name,
    COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text) AS genre,
    p.instrument::text AS instrument,
    COALESCE(p.entertainer_categories, ARRAY[]::text[]) AS entertainer_categories
  FROM public.entertainer_subscribers es
  JOIN public.profiles p ON p.id = es.user_id
  LEFT JOIN public.artist_profiles ap ON ap.user_id = p.id
  WHERE es.status = 'active'
    AND (es.current_period_end IS NULL OR es.current_period_end > now())
  ORDER BY p.name;
$function$;