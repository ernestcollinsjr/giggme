-- Create pinned_messages table
CREATE TABLE public.pinned_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_user_id UUID NOT NULL,
  pinned_by UUID NOT NULL,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, conversation_user_id, pinned_by)
);

-- Enable RLS
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- Users can view pinned messages in their conversations
CREATE POLICY "Users can view pinned messages"
ON public.pinned_messages
FOR SELECT
USING (auth.uid() = pinned_by OR auth.uid() = conversation_user_id);

-- Users can pin messages
CREATE POLICY "Users can pin messages"
ON public.pinned_messages
FOR INSERT
WITH CHECK (auth.uid() = pinned_by);

-- Users can unpin their own pins
CREATE POLICY "Users can unpin messages"
ON public.pinned_messages
FOR DELETE
USING (auth.uid() = pinned_by);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;