ALTER TABLE public.message_typing_status
  DROP CONSTRAINT IF EXISTS message_typing_status_user_id_fkey,
  DROP CONSTRAINT IF EXISTS message_typing_status_recipient_id_fkey;