-- Drop trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop and recreate function with proper search path
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'role')::public.app_role,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User')
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();