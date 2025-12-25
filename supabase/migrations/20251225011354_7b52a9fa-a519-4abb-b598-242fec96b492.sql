-- Create a function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::app_role
  )
$$;

-- Update profiles RLS to allow super_admin full access
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Super admin can view all user roles
CREATE POLICY "Super admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admin can update all user roles
CREATE POLICY "Super admins can update all user roles"
ON public.user_roles
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Super admin can delete user roles
CREATE POLICY "Super admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Super admin can insert user roles
CREATE POLICY "Super admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));