-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add phone_number column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number text;

-- Create a function to send gig reminders
CREATE OR REPLACE FUNCTION send_gig_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function will be called by cron to trigger the edge function
  -- It will find gigs that need reminders and invoke the edge function
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-sms-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := jsonb_build_object(
      'event_type', 'gig',
      'reminder_type', 'check'
    )
  );
END;
$$;

-- Create a function to send rehearsal reminders
CREATE OR REPLACE FUNCTION send_rehearsal_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function will be called by cron to trigger the edge function
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-sms-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := jsonb_build_object(
      'event_type', 'rehearsal',
      'reminder_type', 'check'
    )
  );
END;
$$;

-- Schedule cron job to check for reminders every 15 minutes
-- This will check if any gigs or rehearsals need 1-day or 1-hour reminders
SELECT cron.schedule(
  'send-event-reminders',
  '*/15 * * * *', -- Every 15 minutes
  $$
    SELECT send_gig_reminders();
    SELECT send_rehearsal_reminders();
  $$
);