-- Create shared_setlists table for shareable links
CREATE TABLE public.shared_setlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_setlists ENABLE ROW LEVEL SECURITY;

-- Owners can manage their shared links
CREATE POLICY "Users can manage their own shared setlists"
ON public.shared_setlists
FOR ALL
USING (auth.uid() = created_by);

-- Anyone can view active shared setlists by token (for public access)
CREATE POLICY "Anyone can view active shared setlists by token"
ON public.shared_setlists
FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Create trigger for updated_at
CREATE TRIGGER update_shared_setlists_updated_at
BEFORE UPDATE ON public.shared_setlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();