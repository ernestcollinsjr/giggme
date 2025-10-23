-- Add transportation_not_provided boolean column to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN transportation_not_provided BOOLEAN DEFAULT false;