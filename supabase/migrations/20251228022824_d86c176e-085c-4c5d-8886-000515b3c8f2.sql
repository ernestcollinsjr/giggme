-- Add reply_to_id column to messages table for threading
ALTER TABLE public.messages 
ADD COLUMN reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;