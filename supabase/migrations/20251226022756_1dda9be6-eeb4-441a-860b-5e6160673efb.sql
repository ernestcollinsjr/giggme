-- Add payment_methods column to artist_profiles table
ALTER TABLE public.artist_profiles 
ADD COLUMN payment_methods jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.artist_profiles.payment_methods IS 'Stores payment method usernames/handles: {venmo: string, cashapp: string, applepay: string}';