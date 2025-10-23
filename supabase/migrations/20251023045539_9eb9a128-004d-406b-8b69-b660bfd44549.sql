-- Create function to auto-enable location sharing on acceptance
CREATE OR REPLACE FUNCTION public.auto_enable_location_sharing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If status changes to 'accepted', automatically enable location sharing
  IF NEW.status = 'accepted' THEN
    NEW.location_sharing_enabled = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on gig_members table
DROP TRIGGER IF EXISTS trigger_auto_enable_location_sharing ON public.gig_members;
CREATE TRIGGER trigger_auto_enable_location_sharing
  BEFORE INSERT OR UPDATE OF status
  ON public.gig_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enable_location_sharing();