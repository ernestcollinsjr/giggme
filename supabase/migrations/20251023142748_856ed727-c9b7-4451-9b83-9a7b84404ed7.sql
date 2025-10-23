-- Add payment tracking fields to gigs table
ALTER TABLE public.gigs 
ADD COLUMN payment_amount numeric,
ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid'));

-- Add comment for documentation
COMMENT ON COLUMN public.gigs.payment_amount IS 'The agreed payment amount for the gig';
COMMENT ON COLUMN public.gigs.payment_status IS 'Payment status: paid or unpaid';