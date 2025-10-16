-- Add venue_contact_person and sound_man_info columns to gigs table
ALTER TABLE public.gigs 
ADD COLUMN venue_contact_person text,
ADD COLUMN sound_man_info text;