
-- gig_travel_status: per-user in-transit state for a gig
CREATE TABLE public.gig_travel_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'gig',
  status text NOT NULL DEFAULT 'not_started',
  started_at timestamp with time zone,
  arrived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gig_travel_status_status_check CHECK (status IN ('not_started','in_transit','arrived')),
  CONSTRAINT gig_travel_status_source_check CHECK (source IN ('gig','booking_request')),
  CONSTRAINT gig_travel_status_unique UNIQUE (gig_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_travel_status TO authenticated;
GRANT ALL ON public.gig_travel_status TO service_role;

ALTER TABLE public.gig_travel_status ENABLE ROW LEVEL SECURITY;

-- A user can manage their own row
CREATE POLICY "Users manage own travel status"
ON public.gig_travel_status
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Gig owner can view all rows for their gig
CREATE POLICY "Gig owner can view travel status"
ON public.gig_travel_status
FOR SELECT
TO authenticated
USING (
  source = 'gig' AND public.is_gig_owner(gig_id, auth.uid())
);

-- Gig members can view all rows for gigs they're part of
CREATE POLICY "Gig members can view travel status"
ON public.gig_travel_status
FOR SELECT
TO authenticated
USING (
  source = 'gig' AND public.is_gig_member(gig_id, auth.uid())
);

-- Booking manager (booker) can view travel status for their booking_requests
CREATE POLICY "Booker can view request travel status"
ON public.gig_travel_status
FOR SELECT
TO authenticated
USING (
  source = 'booking_request'
  AND EXISTS (
    SELECT 1 FROM public.booking_requests br
    WHERE br.id = gig_travel_status.gig_id
      AND br.booker_id = auth.uid()
  )
);

CREATE TRIGGER set_gig_travel_status_updated_at
BEFORE UPDATE ON public.gig_travel_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reminder timestamp columns for gigs
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reminder_3h_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reminder_30m_sent_at timestamp with time zone;

-- Reminder timestamp columns for booking_requests
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reminder_3h_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reminder_30m_sent_at timestamp with time zone;

-- Realtime for travel status
ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_travel_status;
