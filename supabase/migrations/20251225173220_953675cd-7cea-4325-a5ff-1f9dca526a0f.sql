-- Create table for booking managers to manage individual artists
CREATE TABLE public.booking_manager_artists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_manager_id uuid NOT NULL,
  artist_id uuid NOT NULL,
  group_type text DEFAULT 'solo',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(booking_manager_id, artist_id)
);

-- Enable RLS
ALTER TABLE public.booking_manager_artists ENABLE ROW LEVEL SECURITY;

-- Booking managers can manage their artist roster
CREATE POLICY "Booking managers can manage their artists"
  ON public.booking_manager_artists
  FOR ALL
  USING (auth.uid() = booking_manager_id);

-- Artists can see if they are managed
CREATE POLICY "Artists can view their manager relationships"
  ON public.booking_manager_artists
  FOR SELECT
  USING (auth.uid() = artist_id);

-- Add index for performance
CREATE INDEX idx_booking_manager_artists_manager ON public.booking_manager_artists(booking_manager_id);
CREATE INDEX idx_booking_manager_artists_artist ON public.booking_manager_artists(artist_id);