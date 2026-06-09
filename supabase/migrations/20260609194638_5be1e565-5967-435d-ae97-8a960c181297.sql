CREATE TABLE IF NOT EXISTS public.message_typing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_group boolean NOT NULL DEFAULT false,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (conversation_key, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_typing_status TO authenticated;
GRANT ALL ON public.message_typing_status TO service_role;

ALTER TABLE public.message_typing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant typing statuses" ON public.message_typing_status;
CREATE POLICY "Users can view relevant typing statuses"
ON public.message_typing_status
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR recipient_id = auth.uid()
  OR is_group = true
);

DROP POLICY IF EXISTS "Users can create their own typing status" ON public.message_typing_status;
CREATE POLICY "Users can create their own typing status"
ON public.message_typing_status
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own typing status" ON public.message_typing_status;
CREATE POLICY "Users can update their own typing status"
ON public.message_typing_status
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own typing status" ON public.message_typing_status;
CREATE POLICY "Users can delete their own typing status"
ON public.message_typing_status
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.message_typing_status REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_typing_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_typing_status;
  END IF;
END $$;