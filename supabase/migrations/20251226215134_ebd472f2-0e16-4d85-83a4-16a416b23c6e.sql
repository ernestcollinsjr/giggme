-- Add venue latitude and longitude columns to setlists table for map display
ALTER TABLE public.setlists
ADD COLUMN venue_lat numeric,
ADD COLUMN venue_lng numeric;