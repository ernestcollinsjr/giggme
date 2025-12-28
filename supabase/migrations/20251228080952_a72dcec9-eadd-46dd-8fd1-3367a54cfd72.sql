-- Add delivered_to column to messages table for tracking delivery status
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS delivered_to uuid[] DEFAULT ARRAY[]::uuid[];

-- Create a function to mark message as delivered
CREATE OR REPLACE FUNCTION public.mark_message_as_delivered(message_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET delivered_to = array_append(delivered_to, user_id)
  WHERE id = message_id
    AND NOT (delivered_to @> ARRAY[user_id]);
END;
$$;