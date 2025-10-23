-- Add hotel information columns to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN hotel_name TEXT,
ADD COLUMN hotel_address TEXT,
ADD COLUMN hotel_check_in_time TEXT;