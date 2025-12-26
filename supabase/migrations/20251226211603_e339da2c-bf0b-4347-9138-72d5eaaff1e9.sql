-- Create scheduled_reminders table
CREATE TABLE public.scheduled_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('gig', 'rehearsal', 'setlist', 'custom')),
  event_id UUID,
  event_name TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_times TEXT[] NOT NULL DEFAULT '{}',
  is_relative BOOLEAN NOT NULL DEFAULT true,
  custom_datetime TIMESTAMP WITH TIME ZONE,
  target_member_ids UUID[] NOT NULL DEFAULT '{}',
  target_groups TEXT[] NOT NULL DEFAULT '{}',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sent', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for scheduled_reminders
CREATE POLICY "Users can view their own reminders" 
ON public.scheduled_reminders 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders" 
ON public.scheduled_reminders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders" 
ON public.scheduled_reminders 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders" 
ON public.scheduled_reminders 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scheduled_reminders_updated_at
BEFORE UPDATE ON public.scheduled_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();