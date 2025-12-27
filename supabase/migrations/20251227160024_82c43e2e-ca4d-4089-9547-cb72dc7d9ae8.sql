-- Create blocked_users table for user safety features
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  UNIQUE(blocker_id, blocked_id)
);

-- Enable Row Level Security
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocked users list
CREATE POLICY "Users can view their blocked users"
ON public.blocked_users
FOR SELECT
USING (blocker_id = auth.uid());

-- Users can block other users
CREATE POLICY "Users can block other users"
ON public.blocked_users
FOR INSERT
WITH CHECK (blocker_id = auth.uid());

-- Users can unblock users they've blocked
CREATE POLICY "Users can unblock users"
ON public.blocked_users
FOR DELETE
USING (blocker_id = auth.uid());