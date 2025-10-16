-- Add matching fields to rehearsals table to match gigs table
ALTER TABLE public.rehearsals 
ADD COLUMN attire text,
ADD COLUMN food_provided text,
ADD COLUMN venue_contact_person text,
ADD COLUMN sound_man_info text;