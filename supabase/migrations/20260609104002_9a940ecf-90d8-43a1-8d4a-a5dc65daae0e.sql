INSERT INTO public.user_roles (user_id, role)
VALUES ('37f6fc80-4c01-4678-b90d-5b9ed36941f6', 'super_admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;