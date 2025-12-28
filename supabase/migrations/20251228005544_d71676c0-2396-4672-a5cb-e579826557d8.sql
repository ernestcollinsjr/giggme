-- Create performer ratings table for QR code ratings
CREATE TABLE public.performer_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  customer_name TEXT,
  venue_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performer_ratings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert ratings (public QR code access)
CREATE POLICY "Anyone can submit ratings"
ON public.performer_ratings
FOR INSERT
WITH CHECK (true);

-- Allow artists to view their own ratings
CREATE POLICY "Artists can view their own ratings"
ON public.performer_ratings
FOR SELECT
USING (artist_id = auth.uid());

-- Allow public to view ratings for display
CREATE POLICY "Anyone can view ratings"
ON public.performer_ratings
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_performer_ratings_artist_id ON public.performer_ratings(artist_id);