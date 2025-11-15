-- Fix RLS policies for messages table
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view relevant messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages read status" ON public.messages;

-- Create policy for inserting messages (user must be sender)
CREATE POLICY "Users can insert their own messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Create policy for viewing messages (group messages or messages where user is sender/recipient)
CREATE POLICY "Users can view relevant messages" 
ON public.messages 
FOR SELECT 
USING (
  is_group_message = true 
  OR sender_id = auth.uid() 
  OR recipient_id = auth.uid()
);

-- Create policy for updating messages (to mark as read)
CREATE POLICY "Users can update messages read status" 
ON public.messages 
FOR UPDATE 
USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR is_group_message = true);

-- Fix band_members infinite recursion issue
-- Create security definer function to check band membership
CREATE OR REPLACE FUNCTION public.is_band_member(_band_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members
    WHERE band_id = _band_id
      AND member_id = _user_id
  )
$$;

-- Drop and recreate band_members policies using the security definer function
DROP POLICY IF EXISTS "Band members can view their own membership" ON public.band_members;
DROP POLICY IF EXISTS "Band leaders can manage members" ON public.band_members;

-- Band members can view their own band memberships
CREATE POLICY "Band members can view their own membership" 
ON public.band_members 
FOR SELECT 
USING (member_id = auth.uid());

-- Band leaders can manage their band members
CREATE POLICY "Band leaders can manage their band members" 
ON public.band_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.bands b
    WHERE b.id = band_members.band_id
      AND b.band_leader_id = auth.uid()
  )
);