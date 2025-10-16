-- Add food_provided column to gigs table
ALTER TABLE public.gigs 
ADD COLUMN food_provided text;