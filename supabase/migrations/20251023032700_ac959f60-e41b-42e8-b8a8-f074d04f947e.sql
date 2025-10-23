-- Create a table to link booking managers to bands they manage
CREATE TABLE IF NOT EXISTS public.booking_manager_bands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_manager_id UUID NOT NULL,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_manager_id, band_id)
);

-- Enable RLS
ALTER TABLE public.booking_manager_bands ENABLE ROW LEVEL SECURITY;

-- Booking managers can view their managed bands
CREATE POLICY "Booking managers can view their managed bands"
ON public.booking_manager_bands
FOR SELECT
USING (auth.uid() = booking_manager_id);

-- Booking managers can add bands they manage
CREATE POLICY "Booking managers can add managed bands"
ON public.booking_manager_bands
FOR INSERT
WITH CHECK (auth.uid() = booking_manager_id);

-- Booking managers can remove bands they manage
CREATE POLICY "Booking managers can remove managed bands"
ON public.booking_manager_bands
FOR DELETE
USING (auth.uid() = booking_manager_id);

-- Band leaders can see who manages their band
CREATE POLICY "Band leaders can see their booking managers"
ON public.booking_manager_bands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = booking_manager_bands.band_id
    AND bands.band_leader_id = auth.uid()
  )
);