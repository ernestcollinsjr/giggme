-- Add gig_id column to link rehearsals to gigs
ALTER TABLE public.rehearsals 
ADD COLUMN gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_rehearsals_gig_id ON public.rehearsals(gig_id);