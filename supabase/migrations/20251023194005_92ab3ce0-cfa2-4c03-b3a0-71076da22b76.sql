-- Add lobby_time column to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN lobby_time TEXT;