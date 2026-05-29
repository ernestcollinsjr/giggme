ALTER TABLE public.booking_manager_artists
ADD COLUMN IF NOT EXISTS group_name text;

CREATE INDEX IF NOT EXISTS idx_booking_manager_artists_group_name
ON public.booking_manager_artists(booking_manager_id, group_name);