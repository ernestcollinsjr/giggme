-- Add venue_name column to gigs table
ALTER TABLE public.gigs
ADD COLUMN venue_name TEXT;