-- Add policy to allow viewing profiles of users in message conversations
CREATE POLICY "Users can view profiles of message participants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE (m.sender_id = auth.uid() AND m.recipient_id = profiles.id)
       OR (m.recipient_id = auth.uid() AND m.sender_id = profiles.id)
  )
);