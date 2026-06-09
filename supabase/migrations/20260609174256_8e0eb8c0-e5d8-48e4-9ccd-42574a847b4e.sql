-- 1) Hard DB constraint: only one super_admin row allowed
CREATE UNIQUE INDEX IF NOT EXISTS one_super_admin_only
  ON public.user_roles ((role))
  WHERE role = 'super_admin'::public.app_role;

-- 2) RLS guard: block anyone except the current super_admin from creating/changing a super_admin row
DROP POLICY IF EXISTS "Only super_admin can assign super_admin" ON public.user_roles;
CREATE POLICY "Only super_admin can assign super_admin"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  role <> 'super_admin'::public.app_role
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only super_admin can modify super_admin rows" ON public.user_roles;
CREATE POLICY "Only super_admin can modify super_admin rows"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  role <> 'super_admin'::public.app_role
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  role <> 'super_admin'::public.app_role
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only super_admin can delete super_admin rows" ON public.user_roles;
CREATE POLICY "Only super_admin can delete super_admin rows"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  role <> 'super_admin'::public.app_role
  OR public.is_super_admin(auth.uid())
);