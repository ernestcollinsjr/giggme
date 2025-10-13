-- Add set_number column to setlist_songs table
ALTER TABLE public.setlist_songs
ADD COLUMN set_number integer NOT NULL DEFAULT 1;

-- Add check constraint to ensure set_number is between 1 and 4
ALTER TABLE public.setlist_songs
ADD CONSTRAINT valid_set_number CHECK (set_number >= 1 AND set_number <= 4);