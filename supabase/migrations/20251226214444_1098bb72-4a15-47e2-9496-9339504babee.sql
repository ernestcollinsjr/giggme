-- Add event and rehearsal information fields to setlists table
ALTER TABLE public.setlists
ADD COLUMN event_date timestamp with time zone,
ADD COLUMN event_time text,
ADD COLUMN call_time text,
ADD COLUMN rehearsal_date timestamp with time zone,
ADD COLUMN rehearsal_time text,
ADD COLUMN rehearsal_call_time text,
ADD COLUMN address text,
ADD COLUMN notes text,
ADD COLUMN music_leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;