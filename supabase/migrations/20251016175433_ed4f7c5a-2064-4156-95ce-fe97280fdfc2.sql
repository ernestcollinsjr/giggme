-- Add end_time column to gigs and rehearsals tables
ALTER TABLE public.gigs 
ADD COLUMN end_time text;

ALTER TABLE public.rehearsals 
ADD COLUMN end_time text;