-- Add recipient support to messages table
ALTER TABLE public.messages
ADD COLUMN recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN is_group_message boolean DEFAULT true;

-- Add index for faster queries
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

-- Update RLS policies for targeted messaging
DROP POLICY IF EXISTS "Band members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Band members can send messages" ON public.messages;

-- Users can view messages they sent
CREATE POLICY "Users can view their sent messages"
ON public.messages
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id);

-- Users can view messages sent to them
CREATE POLICY "Users can view messages sent to them"
ON public.messages
FOR SELECT
TO authenticated
USING (
  recipient_id = auth.uid() OR 
  (is_group_message = true AND (has_role(auth.uid(), 'band_member'::app_role) OR has_role(auth.uid(), 'band_leader'::app_role)))
);

-- Users can send messages
CREATE POLICY "Authenticated users can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND 
  (has_role(auth.uid(), 'band_member'::app_role) OR has_role(auth.uid(), 'band_leader'::app_role))
);