-- Fix security issues from previous migration

-- Drop the view that had security definer issues
DROP VIEW IF EXISTS public.active_member_locations;

-- Set proper search_path on the function
CREATE OR REPLACE FUNCTION public.is_in_sharing_window(
  gig_date TIMESTAMP WITH TIME ZONE,
  earliest_time TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_datetime TIMESTAMP WITH TIME ZONE;
  sharing_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Combine date with earliest time (default to date if no time specified)
  IF earliest_time IS NOT NULL AND earliest_time != '' THEN
    event_datetime := (gig_date::date || ' ' || earliest_time)::timestamp with time zone;
  ELSE
    event_datetime := gig_date;
  END IF;
  
  -- Sharing starts 1 hour before the event
  sharing_start := event_datetime - INTERVAL '1 hour';
  
  -- Check if current time is within sharing window (1 hour before until event time)
  RETURN (NOW() >= sharing_start AND NOW() <= event_datetime + INTERVAL '4 hours');
END;
$$;