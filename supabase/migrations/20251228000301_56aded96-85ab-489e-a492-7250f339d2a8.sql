-- Create email tracking table
CREATE TABLE public.email_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID REFERENCES public.gigs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  email TEXT NOT NULL,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

-- Band leaders can view tracking for their gigs
CREATE POLICY "Band leaders can view email tracking for their gigs"
ON public.email_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gigs
    WHERE gigs.id = email_tracking.gig_id
    AND gigs.user_id = auth.uid()
  )
);

-- System can insert/update tracking records
CREATE POLICY "System can manage email tracking"
ON public.email_tracking
FOR ALL
USING (true)
WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_email_tracking_updated_at
BEFORE UPDATE ON public.email_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();