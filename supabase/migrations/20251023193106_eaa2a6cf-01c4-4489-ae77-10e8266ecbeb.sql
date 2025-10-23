-- Add hotel check-out columns to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN hotel_check_out_date DATE,
ADD COLUMN hotel_check_out_time TEXT;