-- Create user_reports table for reporting functionality
CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_notes text
);

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports"
ON public.user_reports
FOR INSERT
WITH CHECK (reporter_id = auth.uid());

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.user_reports
FOR SELECT
USING (reporter_id = auth.uid());

-- Super admins can manage all reports
CREATE POLICY "Super admins can manage reports"
ON public.user_reports
FOR ALL
USING (is_super_admin(auth.uid()));