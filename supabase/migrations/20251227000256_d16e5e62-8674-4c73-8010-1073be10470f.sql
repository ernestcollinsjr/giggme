-- Add sound_volume column to notification_preferences (0.0 to 1.0)
ALTER TABLE public.notification_preferences
ADD COLUMN sound_volume numeric DEFAULT 0.5;