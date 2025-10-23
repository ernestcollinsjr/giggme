-- Add bus_call_time column to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN bus_call_time TEXT;