-- Allow tour managers to view all profiles so they can add crew members
CREATE POLICY "Tour managers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'tour_manager'
  )
);