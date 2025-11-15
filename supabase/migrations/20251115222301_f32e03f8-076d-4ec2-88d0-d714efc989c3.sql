-- Fix messages RLS policies - drop the correct policy names this time
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages sent to them" ON public.messages;
DROP POLICY IF EXISTS "Users can view their sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view relevant messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages read status" ON public.messages;

-- Create comprehensive policies for all user roles including booking_manager
CREATE POLICY "Anyone authenticated can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view relevant messages" 
ON public.messages 
FOR SELECT 
USING (
  is_group_message = true 
  OR sender_id = auth.uid() 
  OR recipient_id = auth.uid()
);

CREATE POLICY "Users can update message read status" 
ON public.messages 
FOR UPDATE 
USING (
  sender_id = auth.uid() 
  OR recipient_id = auth.uid() 
  OR is_group_message = true
);