-- Create tour_dates table
CREATE TABLE public.tour_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  venue TEXT NOT NULL,
  venue_name TEXT,
  venue_lat NUMERIC,
  venue_lng NUMERIC,
  show_time TEXT,
  loading_time TEXT,
  sound_check_time TEXT,
  end_time TEXT,
  attire TEXT,
  food_provided TEXT,
  venue_contact_person TEXT,
  sound_man_info TEXT,
  notes TEXT,
  payment_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tour_dates ENABLE ROW LEVEL SECURITY;

-- Tour managers can manage dates for their tours
CREATE POLICY "Tour managers can manage their tour dates"
ON public.tour_dates
FOR ALL
TO authenticated
USING (is_tour_manager(tour_id, auth.uid()))
WITH CHECK (is_tour_manager(tour_id, auth.uid()));

-- Crew members can view dates for tours they're assigned to
CREATE POLICY "Crew can view assigned tour dates"
ON public.tour_dates
FOR SELECT
TO authenticated
USING (is_assigned_to_tour(tour_id, auth.uid()));

-- Create index for performance
CREATE INDEX idx_tour_dates_tour_id ON public.tour_dates(tour_id);
CREATE INDEX idx_tour_dates_date ON public.tour_dates(date);

-- Add updated_at trigger
CREATE TRIGGER update_tour_dates_updated_at
BEFORE UPDATE ON public.tour_dates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();