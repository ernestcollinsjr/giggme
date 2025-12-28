-- Fix the mark_message_as_read function - disambiguate column references
CREATE OR REPLACE FUNCTION public.mark_message_as_read(message_id uuid, user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages m
  SET read_by = array_append(
    COALESCE(m.read_by, ARRAY[]::uuid[]),
    mark_message_as_read.user_id
  )
  WHERE m.id = mark_message_as_read.message_id
    AND NOT (mark_message_as_read.user_id = ANY(COALESCE(m.read_by, ARRAY[]::uuid[])));
END;
$$;