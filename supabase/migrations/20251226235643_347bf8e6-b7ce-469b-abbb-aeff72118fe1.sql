-- Add sound_muted column to notification_preferences
ALTER TABLE public.notification_preferences
ADD COLUMN sound_muted boolean DEFAULT false;