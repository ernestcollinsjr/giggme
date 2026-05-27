-- Remove existing duplicates, keeping the earliest created record per (user_id, date, lower(venue))
DELETE FROM public.gigs a
USING public.gigs b
WHERE a.user_id = b.user_id
  AND a.date = b.date
  AND lower(trim(a.venue)) = lower(trim(b.venue))
  AND a.created_at > b.created_at;

-- Enforce uniqueness with a case-insensitive, trim-tolerant index
CREATE UNIQUE INDEX IF NOT EXISTS gigs_unique_performer_date_venue
  ON public.gigs (user_id, date, lower(trim(venue)));