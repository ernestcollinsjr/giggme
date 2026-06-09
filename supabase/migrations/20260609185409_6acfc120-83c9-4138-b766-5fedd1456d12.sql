CREATE POLICY "Super admins can view all messages"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));