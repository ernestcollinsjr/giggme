-- Add venue coordinates to rehearsals table
ALTER TABLE public.rehearsals 
ADD COLUMN venue_lat NUMERIC,
ADD COLUMN venue_lng NUMERIC;

COMMENT ON COLUMN public.rehearsals.venue_lat IS 'Venue latitude for navigation';
COMMENT ON COLUMN public.rehearsals.venue_lng IS 'Venue longitude for navigation';

-- Add venue coordinates to gigs table  
ALTER TABLE public.gigs
ADD COLUMN venue_lat NUMERIC,
ADD COLUMN venue_lng NUMERIC;

COMMENT ON COLUMN public.gigs.venue_lat IS 'Venue latitude for navigation';
COMMENT ON COLUMN public.gigs.venue_lng IS 'Venue longitude for navigation';