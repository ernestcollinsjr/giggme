-- Add lyrics column to setlist_songs table
ALTER TABLE public.setlist_songs 
ADD COLUMN lyrics text;