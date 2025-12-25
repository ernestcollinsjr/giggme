-- Make band_id nullable to support artist-only requests
ALTER TABLE public.availability_requests 
  ALTER COLUMN band_id DROP NOT NULL;

-- Add booking_manager_id for manager-created requests
ALTER TABLE public.availability_requests 
  ADD COLUMN booking_manager_id uuid,
  ADD COLUMN target_artist_ids uuid[] DEFAULT '{}';

-- Update RLS policies to allow booking managers to manage their requests
CREATE POLICY "Booking managers can manage their availability requests"
  ON public.availability_requests
  FOR ALL
  USING (auth.uid() = booking_manager_id);

-- Allow targeted artists to view requests
CREATE POLICY "Artists can view requests targeting them"
  ON public.availability_requests
  FOR SELECT
  USING (auth.uid() = ANY(target_artist_ids));

-- Allow booking managers to view responses for their requests
CREATE POLICY "Booking managers can view responses for their requests"
  ON public.availability_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM availability_requests ar
      WHERE ar.id = availability_responses.request_id
      AND ar.booking_manager_id = auth.uid()
    )
  );