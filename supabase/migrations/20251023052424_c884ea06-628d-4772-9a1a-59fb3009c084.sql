-- Add read tracking to messages table
ALTER TABLE public.messages
ADD COLUMN read_by uuid[] DEFAULT ARRAY[]::uuid[];

-- Create index for faster queries on read status
CREATE INDEX idx_messages_read_by ON public.messages USING GIN(read_by);

-- Add a function to mark messages as read
CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET read_by = array_append(read_by, user_id)
  WHERE id = message_id
    AND NOT (read_by @> ARRAY[user_id]);
END;
$$;