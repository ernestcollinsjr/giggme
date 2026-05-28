-- Table to track active entertainer memberships (synced from Stripe)
CREATE TABLE public.entertainer_subscribers (
  user_id UUID PRIMARY KEY,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entertainer_subscribers TO authenticated;
GRANT ALL ON public.entertainer_subscribers TO service_role;

ALTER TABLE public.entertainer_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own entertainer subscription"
ON public.entertainer_subscribers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_entertainer_subscribers_updated_at
BEFORE UPDATE ON public.entertainer_subscribers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Public function returning the featured (subscribed) entertainers
CREATE OR REPLACE FUNCTION public.get_featured_entertainers()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  bio TEXT,
  photo_urls TEXT[],
  performer_category TEXT,
  stage_name TEXT,
  genre TEXT,
  instrument TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.name,
    p.bio,
    p.photo_urls,
    p.performer_category,
    ap.stage_name,
    COALESCE(ap.genre, NULLIF(p.genres[1], ''), p.instrument::text) AS genre,
    p.instrument::text AS instrument
  FROM public.entertainer_subscribers es
  JOIN public.profiles p ON p.id = es.user_id
  LEFT JOIN public.artist_profiles ap ON ap.user_id = p.id
  WHERE es.status = 'active'
    AND (es.current_period_end IS NULL OR es.current_period_end > now())
  ORDER BY p.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_featured_entertainers() TO anon, authenticated;