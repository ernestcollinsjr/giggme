-- Add location sharing consent to gig_members
ALTER TABLE public.gig_members 
ADD COLUMN location_sharing_enabled BOOLEAN DEFAULT false;

-- Create a function to check if we're within the location sharing window
CREATE OR REPLACE FUNCTION public.is_in_sharing_window(
  gig_date TIMESTAMP WITH TIME ZONE,
  earliest_time TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
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

COMMENT ON FUNCTION public.is_in_sharing_window IS 'Checks if current time is within 1 hour before and 4 hours after event start';

-- Create a view to get active location sharing for band leaders
CREATE OR REPLACE VIEW public.active_member_locations AS
SELECT 
  gm.gig_id,
  gm.member_id,
  p.name,
  p.location_lat,
  p.location_lng,
  p.updated_at as last_location_update,
  g.date as gig_date,
  g.venue,
  COALESCE(g.loading_time, g.sound_check_time, '00:00') as earliest_time
FROM public.gig_members gm
JOIN public.gigs g ON gm.gig_id = g.id
JOIN public.profiles p ON gm.member_id = p.id
WHERE 
  gm.status = 'accepted'
  AND gm.location_sharing_enabled = true
  AND public.is_in_sharing_window(g.date, COALESCE(g.loading_time, g.sound_check_time, '00:00'));

-- Grant permissions
GRANT SELECT ON public.active_member_locations TO authenticated;