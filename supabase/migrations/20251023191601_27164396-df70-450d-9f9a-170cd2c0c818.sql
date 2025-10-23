-- Add per_diem column to tour_dates table
ALTER TABLE public.tour_dates
ADD COLUMN per_diem NUMERIC;