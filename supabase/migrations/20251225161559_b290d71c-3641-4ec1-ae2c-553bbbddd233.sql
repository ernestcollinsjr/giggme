-- Create table for member availability dates
CREATE TABLE public.member_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'tentative')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.member_availability ENABLE ROW LEVEL SECURITY;

-- Users can manage their own availability
CREATE POLICY "Users can manage their own availability"
ON public.member_availability
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Band leaders can view member availability
CREATE POLICY "Band leaders can view member availability"
ON public.member_availability
FOR SELECT
USING (
  has_role(auth.uid(), 'band_leader'::app_role) OR
  has_role(auth.uid(), 'booking_manager'::app_role) OR
  has_role(auth.uid(), 'tour_manager'::app_role)
);

-- Update trigger
CREATE TRIGGER update_member_availability_updated_at
BEFORE UPDATE ON public.member_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();