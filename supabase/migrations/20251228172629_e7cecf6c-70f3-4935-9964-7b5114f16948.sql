-- Enable REPLICA IDENTITY FULL for messages table to ensure complete row data in realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;