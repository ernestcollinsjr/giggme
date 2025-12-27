-- Add sound_type column to notification_preferences
ALTER TABLE public.notification_preferences
ADD COLUMN sound_type text DEFAULT 'chime';