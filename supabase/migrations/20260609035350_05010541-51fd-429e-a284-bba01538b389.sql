ALTER TABLE public.booking_requests
ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;

UPDATE public.booking_requests
SET location_sharing_enabled = true
WHERE status = 'accepted';

CREATE OR REPLACE FUNCTION public.enable_booking_request_location_sharing_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.location_sharing_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enable_booking_request_location_sharing_on_accept ON public.booking_requests;
CREATE TRIGGER trg_enable_booking_request_location_sharing_on_accept
BEFORE INSERT OR UPDATE OF status ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.enable_booking_request_location_sharing_on_accept();