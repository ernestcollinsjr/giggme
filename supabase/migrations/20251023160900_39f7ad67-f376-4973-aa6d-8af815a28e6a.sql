-- Add tour_manager role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tour_manager';

-- Create tours table
CREATE TABLE public.tours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tour_crew_members table
CREATE TABLE public.tour_crew_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  crew_member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  role_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tour_id, crew_member_id)
);

-- Create tour_invitations table for sending invites
CREATE TABLE public.tour_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  tour_manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Enable RLS on all tables
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_invitations ENABLE ROW LEVEL SECURITY;

-- Tour policies
CREATE POLICY "Tour managers can manage their tours"
ON public.tours
FOR ALL
TO authenticated
USING (auth.uid() = tour_manager_id);

CREATE POLICY "Tour crew can view their tours"
ON public.tours
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tour_crew_members
    WHERE tour_id = tours.id
    AND crew_member_id = auth.uid()
  )
);

-- Tour crew members policies
CREATE POLICY "Tour managers can manage their tour crew"
ON public.tour_crew_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tours
    WHERE tours.id = tour_crew_members.tour_id
    AND tours.tour_manager_id = auth.uid()
  )
);

CREATE POLICY "Crew members can manage their responses"
ON public.tour_crew_members
FOR ALL
TO authenticated
USING (auth.uid() = crew_member_id);

-- Tour invitations policies
CREATE POLICY "Tour managers can manage their invitations"
ON public.tour_invitations
FOR ALL
TO authenticated
USING (auth.uid() = tour_manager_id);

CREATE POLICY "Anyone can view invitations by token"
ON public.tour_invitations
FOR SELECT
TO authenticated
USING (status = 'pending' AND expires_at > now());

-- Add updated_at triggers
CREATE TRIGGER update_tours_updated_at
BEFORE UPDATE ON public.tours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tour_crew_members_updated_at
BEFORE UPDATE ON public.tour_crew_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();