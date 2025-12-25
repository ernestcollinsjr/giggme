-- Add response deadline and replacement tracking to gig_members
ALTER TABLE public.gig_members 
ADD COLUMN IF NOT EXISTS response_deadline timestamp with time zone,
ADD COLUMN IF NOT EXISTS replacement_triggered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS replaced_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS replacement_reason text;

-- Add default response deadline setting to gigs table
ALTER TABLE public.gigs 
ADD COLUMN IF NOT EXISTS response_deadline_hours integer DEFAULT 2;

-- Create index for efficient querying of pending responses
CREATE INDEX IF NOT EXISTS idx_gig_members_pending_deadline 
ON public.gig_members(response_deadline) 
WHERE status = 'pending' AND replacement_triggered = false;

-- Add comment explaining the columns
COMMENT ON COLUMN public.gig_members.response_deadline IS 'Timestamp by which member must respond or replacement will be triggered';
COMMENT ON COLUMN public.gig_members.replacement_triggered IS 'Whether auto-replacement has been triggered for this member';
COMMENT ON COLUMN public.gig_members.replaced_by IS 'ID of the member who replaced this one';
COMMENT ON COLUMN public.gig_members.replacement_reason IS 'Reason for replacement (timeout, declined, etc.)';
COMMENT ON COLUMN public.gigs.response_deadline_hours IS 'Hours members have to respond before auto-replacement';