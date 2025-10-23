-- Add hotel_notes and general_notes columns to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN hotel_notes TEXT,
ADD COLUMN general_notes TEXT;