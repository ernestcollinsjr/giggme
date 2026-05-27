
CREATE TABLE public.replacement_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  requester_email TEXT,
  requester_name TEXT,
  venue TEXT,
  event_date DATE,
  event_time TEXT,
  message TEXT NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  filled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.replacement_request_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.replacement_requests(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL,
  performer_email TEXT,
  performer_name TEXT,
  response_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, performer_id)
);

CREATE INDEX idx_rr_requester ON public.replacement_requests(requester_id, created_at DESC);
CREATE INDEX idx_rrr_request ON public.replacement_request_recipients(request_id);
CREATE INDEX idx_rrr_performer ON public.replacement_request_recipients(performer_id);
CREATE INDEX idx_rr_open_deadline ON public.replacement_requests(status, deadline_at) WHERE status = 'open';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.replacement_requests TO authenticated;
GRANT ALL ON public.replacement_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replacement_request_recipients TO authenticated;
GRANT ALL ON public.replacement_request_recipients TO service_role;

ALTER TABLE public.replacement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_request_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view their replacement requests"
ON public.replacement_requests FOR SELECT TO authenticated
USING (auth.uid() = requester_id);

CREATE POLICY "Requesters can create replacement requests"
ON public.replacement_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requesters can update their replacement requests"
ON public.replacement_requests FOR UPDATE TO authenticated
USING (auth.uid() = requester_id);

CREATE POLICY "Requester or recipient can view recipients"
ON public.replacement_request_recipients FOR SELECT TO authenticated
USING (
  auth.uid() = performer_id
  OR EXISTS (
    SELECT 1 FROM public.replacement_requests r
    WHERE r.id = request_id AND r.requester_id = auth.uid()
  )
);

CREATE POLICY "Requester can insert recipients"
ON public.replacement_request_recipients FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.replacement_requests r
    WHERE r.id = request_id AND r.requester_id = auth.uid()
  )
);

CREATE TRIGGER trg_rr_updated_at
BEFORE UPDATE ON public.replacement_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
