CREATE OR REPLACE FUNCTION public.get_performer_venues()
RETURNS TABLE(user_id uuid, venues text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id, array_agg(DISTINCT venue) FILTER (WHERE venue IS NOT NULL AND venue <> '') AS venues
  FROM (
    SELECT g.user_id, COALESCE(NULLIF(g.venue_name, ''), g.venue) AS venue
    FROM public.gigs g
    UNION ALL
    SELECT gm.member_id AS user_id, COALESCE(NULLIF(g.venue_name, ''), g.venue) AS venue
    FROM public.gig_members gm
    JOIN public.gigs g ON g.id = gm.gig_id
    WHERE gm.status = 'accepted'
    UNION ALL
    SELECT br.performer_id AS user_id, br.venue
    FROM public.booking_requests br
    WHERE br.status::text IN ('accepted','confirmed')
    UNION ALL
    SELECT eb.entertainer_id AS user_id, v.name AS venue
    FROM public.entertainment_bookings eb
    JOIN public.venues v ON v.id = eb.venue_id
    WHERE eb.status::text IN ('accepted','confirmed')
  ) t
  WHERE user_id IS NOT NULL
  GROUP BY user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_performer_venues() TO anon, authenticated, service_role;