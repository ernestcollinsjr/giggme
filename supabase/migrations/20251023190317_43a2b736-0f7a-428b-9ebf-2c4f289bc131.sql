-- Add ground_transportation column to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN ground_transportation TEXT;