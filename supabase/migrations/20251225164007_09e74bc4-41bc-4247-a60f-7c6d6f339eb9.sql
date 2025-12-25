-- Create availability requests table for managers to request availability from members
CREATE TABLE public.availability_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create responses table for members to submit their availability
CREATE TABLE public.availability_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.availability_requests(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  available_dates DATE[] NOT NULL DEFAULT '{}',
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(request_id, member_id)
);

-- Enable RLS
ALTER TABLE public.availability_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for availability_requests
CREATE POLICY "Band leaders can manage availability requests"
  ON public.availability_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE bands.id = availability_requests.band_id
      AND bands.band_leader_id = auth.uid()
    )
  );

CREATE POLICY "Band members can view availability requests"
  ON public.availability_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members
      WHERE band_members.band_id = availability_requests.band_id
      AND band_members.member_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE bands.id = availability_requests.band_id
      AND bands.band_leader_id = auth.uid()
    )
  );

-- RLS policies for availability_responses
CREATE POLICY "Members can manage their own responses"
  ON public.availability_responses
  FOR ALL
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Band leaders can view all responses for their requests"
  ON public.availability_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.availability_requests ar
      JOIN public.bands b ON b.id = ar.band_id
      WHERE ar.id = availability_responses.request_id
      AND b.band_leader_id = auth.uid()
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_availability_requests_updated_at
  BEFORE UPDATE ON public.availability_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_availability_responses_updated_at
  BEFORE UPDATE ON public.availability_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();