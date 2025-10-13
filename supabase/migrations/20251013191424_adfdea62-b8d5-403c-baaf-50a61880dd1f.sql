-- Allow users to manage their own roles (for development/testing)
CREATE POLICY "Users can insert their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own role"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own role"
ON public.user_roles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);