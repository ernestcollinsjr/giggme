-- Create tips tracking table
CREATE TABLE public.artist_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipper_name TEXT,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.artist_tips ENABLE ROW LEVEL SECURITY;

-- Artists can view their own tips
CREATE POLICY "Artists can view their own tips"
ON public.artist_tips
FOR SELECT
USING (auth.uid() = artist_id);

-- Artists can insert their own tips (for manual tracking)
CREATE POLICY "Artists can insert their own tips"
ON public.artist_tips
FOR INSERT
WITH CHECK (auth.uid() = artist_id);

-- Artists can update their own tips
CREATE POLICY "Artists can update their own tips"
ON public.artist_tips
FOR UPDATE
USING (auth.uid() = artist_id);

-- Artists can delete their own tips
CREATE POLICY "Artists can delete their own tips"
ON public.artist_tips
FOR DELETE
USING (auth.uid() = artist_id);