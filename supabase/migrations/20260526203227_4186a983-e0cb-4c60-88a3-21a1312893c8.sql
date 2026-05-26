ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS event_date timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

ALTER TABLE public.gig_members
  ADD COLUMN IF NOT EXISTS reminder_1d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_booking_requests_event_date ON public.booking_requests(event_date) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_gig_members_status ON public.gig_members(status);