INSERT INTO public.user_roles (user_id, role)
VALUES ('8f7d5544-a1c2-477e-809d-16e13163476d', 'booking_manager'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;