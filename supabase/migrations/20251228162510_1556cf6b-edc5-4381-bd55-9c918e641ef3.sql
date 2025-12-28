-- Add separate sound type columns for sent and delivered notifications
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS sent_sound_type TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS delivered_sound_type TEXT DEFAULT 'chime';