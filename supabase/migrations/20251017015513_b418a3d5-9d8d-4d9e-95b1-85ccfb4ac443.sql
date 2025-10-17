-- Create bands table
CREATE TABLE public.bands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;

-- Band leaders can manage their bands
CREATE POLICY "Band leaders can manage their bands"
ON public.bands
FOR ALL
USING (auth.uid() = band_leader_id);

-- Band members can view bands
CREATE POLICY "Band members can view bands"
ON public.bands
FOR SELECT
USING (has_role(auth.uid(), 'band_member'::app_role) OR has_role(auth.uid(), 'band_leader'::app_role));

-- Add band_id to rehearsals table
ALTER TABLE public.rehearsals
ADD COLUMN band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

-- Add band_id to setlists table
ALTER TABLE public.setlists
ADD COLUMN band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE;

-- Add band_id to gigs table
ALTER TABLE public.gigs
ADD COLUMN band_id UUID REFERENCES public.gigs(id) ON DELETE CASCADE;

-- Create trigger for automatic timestamp updates on bands
CREATE TRIGGER update_bands_updated_at
BEFORE UPDATE ON public.bands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();