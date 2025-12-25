-- Create table for member group presets
CREATE TABLE public.member_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL,
  member_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_groups ENABLE ROW LEVEL SECURITY;

-- Band leaders can manage their groups
CREATE POLICY "Band leaders can manage member groups"
ON public.member_groups
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = member_groups.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Booking managers can manage groups for bands they manage
CREATE POLICY "Booking managers can manage member groups"
ON public.member_groups
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.booking_manager_bands bmb
    WHERE bmb.band_id = member_groups.band_id
    AND bmb.booking_manager_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_member_groups_updated_at
  BEFORE UPDATE ON public.member_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();