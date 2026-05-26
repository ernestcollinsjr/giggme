CREATE TYPE public.booking_request_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE public.booking_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booker_id UUID NOT NULL,
  performer_id UUID NOT NULL,
  booker_name TEXT,
  booker_email TEXT,
  performer_name TEXT,
  performer_email TEXT,
  dates_text TEXT NOT NULL,
  time_text TEXT,
  venue TEXT NOT NULL,
  venue_phone TEXT,
  budget TEXT,
  contact_person TEXT,
  dress_code TEXT,
  note TEXT,
  status public.booking_request_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  responded_at TIMESTAMPTZ,
  expired_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booker can view their requests"
  ON public.booking_requests FOR SELECT TO authenticated
  USING (auth.uid() = booker_id);

CREATE POLICY "Performer can view their requests"
  ON public.booking_requests FOR SELECT TO authenticated
  USING (auth.uid() = performer_id);

CREATE POLICY "Booker can create requests"
  ON public.booking_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = booker_id);

CREATE POLICY "Performer can respond to pending requests"
  ON public.booking_requests FOR UPDATE TO authenticated
  USING (auth.uid() = performer_id AND status = 'pending' AND expires_at > now())
  WITH CHECK (auth.uid() = performer_id AND status IN ('accepted', 'declined'));

CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_booking_requests_expiry ON public.booking_requests (status, expires_at) WHERE status = 'pending';
CREATE INDEX idx_booking_requests_booker ON public.booking_requests (booker_id, created_at DESC);
CREATE INDEX idx_booking_requests_performer ON public.booking_requests (performer_id, created_at DESC);