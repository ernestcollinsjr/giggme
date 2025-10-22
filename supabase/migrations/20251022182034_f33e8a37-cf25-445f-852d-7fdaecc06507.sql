-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for gig_members table (for live RSVP updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_members;

-- Create gig templates table for recurring venue automation
CREATE TABLE IF NOT EXISTS public.gig_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  venue_name TEXT,
  venue_lat NUMERIC,
  venue_lng NUMERIC,
  default_start_time TEXT,
  default_end_time TEXT,
  default_loading_time TEXT,
  default_sound_check_time TEXT,
  attire TEXT,
  food_provided TEXT,
  venue_contact_person TEXT,
  sound_man_info TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gig_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gig_templates
CREATE POLICY "Users can manage their own gig templates"
ON public.gig_templates
FOR ALL
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_gig_templates_updated_at
BEFORE UPDATE ON public.gig_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();