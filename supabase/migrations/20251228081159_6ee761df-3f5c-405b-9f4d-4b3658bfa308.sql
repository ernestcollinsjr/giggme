-- Create read_receipts table to track when messages are read
CREATE TABLE public.read_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages they can see
CREATE POLICY "Users can view read receipts"
ON public.read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = read_receipts.message_id
    AND (m.is_group_message = true OR m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  )
);

-- Users can insert their own read receipts
CREATE POLICY "Users can insert own read receipts"
ON public.read_receipts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update mark_message_as_read function to also insert into read_receipts
CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update read_by array
  UPDATE public.messages
  SET read_by = array_append(read_by, user_id)
  WHERE id = message_id
    AND NOT (read_by @> ARRAY[user_id]);
  
  -- Insert read receipt with timestamp
  INSERT INTO public.read_receipts (message_id, user_id, read_at)
  VALUES (message_id, user_id, now())
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;