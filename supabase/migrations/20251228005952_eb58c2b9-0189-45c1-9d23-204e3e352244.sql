-- Add booking and venue links to performer_ratings
ALTER TABLE public.performer_ratings 
ADD COLUMN booking_id UUID REFERENCES public.entertainment_bookings(id) ON DELETE SET NULL,
ADD COLUMN venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

-- Create index for venue lookups
CREATE INDEX idx_performer_ratings_venue_id ON public.performer_ratings(venue_id);
CREATE INDEX idx_performer_ratings_booking_id ON public.performer_ratings(booking_id);