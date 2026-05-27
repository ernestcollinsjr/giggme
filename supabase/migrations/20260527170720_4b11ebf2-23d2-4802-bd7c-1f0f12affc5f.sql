
-- Helper: mark a user's calendar unavailable for a given date with a note
CREATE OR REPLACE FUNCTION public.mark_calendar_unavailable(_user_id uuid, _date date, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_availability (user_id, date, status, notes)
  VALUES (_user_id, _date, 'unavailable', _note)
  ON CONFLICT (user_id, date)
  DO UPDATE SET status = 'unavailable',
                notes = COALESCE(public.member_availability.notes, '') ||
                        CASE WHEN public.member_availability.notes IS NULL OR public.member_availability.notes = ''
                             THEN _note
                             ELSE E'\n' || _note END,
                updated_at = now()
  WHERE public.member_availability.status <> 'unavailable'
     OR COALESCE(public.member_availability.notes, '') NOT LIKE '%' || _note || '%';
END;
$$;

-- Trigger fn for gig_members
CREATE OR REPLACE FUNCTION public.gig_member_accepted_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g_date date;
  g_venue text;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT date::date, COALESCE(venue_name, venue) INTO g_date, g_venue
    FROM public.gigs WHERE id = NEW.gig_id;
    IF g_date IS NOT NULL THEN
      PERFORM public.mark_calendar_unavailable(NEW.member_id, g_date, 'Gig: ' || COALESCE(g_venue, ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gig_member_accepted_calendar ON public.gig_members;
CREATE TRIGGER trg_gig_member_accepted_calendar
AFTER INSERT OR UPDATE OF status ON public.gig_members
FOR EACH ROW EXECUTE FUNCTION public.gig_member_accepted_to_calendar();

-- Trigger fn for booking_requests
CREATE OR REPLACE FUNCTION public.booking_request_accepted_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM 'accepted') THEN
    IF NEW.performer_id IS NOT NULL AND NEW.event_date IS NOT NULL THEN
      PERFORM public.mark_calendar_unavailable(NEW.performer_id, NEW.event_date::date, 'Booking: ' || COALESCE(NEW.venue, ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_request_accepted_calendar ON public.booking_requests;
CREATE TRIGGER trg_booking_request_accepted_calendar
AFTER INSERT OR UPDATE OF status ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.booking_request_accepted_to_calendar();

-- Trigger fn for entertainment_bookings
CREATE OR REPLACE FUNCTION public.entertainment_booking_accepted_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status::text IN ('accepted','confirmed') AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text) THEN
    SELECT name INTO v_name FROM public.venues WHERE id = NEW.venue_id;
    PERFORM public.mark_calendar_unavailable(NEW.entertainer_id, NEW.date, 'Booking: ' || COALESCE(v_name, ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entertainment_booking_accepted_calendar ON public.entertainment_bookings;
CREATE TRIGGER trg_entertainment_booking_accepted_calendar
AFTER INSERT OR UPDATE OF status ON public.entertainment_bookings
FOR EACH ROW EXECUTE FUNCTION public.entertainment_booking_accepted_to_calendar();
