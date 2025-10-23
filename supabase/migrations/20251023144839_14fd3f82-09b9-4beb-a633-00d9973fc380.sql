-- Add timezone column to profiles table
ALTER TABLE public.profiles
ADD COLUMN timezone TEXT DEFAULT 'America/Chicago';

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.timezone IS 'User preferred timezone in IANA format (e.g., America/Chicago, America/New_York)';