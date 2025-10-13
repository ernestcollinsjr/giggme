-- Create rehearsals table
CREATE TABLE public.rehearsals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create messages table for band chat
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create gig_members table to track band member responses
CREATE TABLE public.gig_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gig_id, member_id)
);

-- Create setlists table
CREATE TABLE public.setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create setlist_songs table
CREATE TABLE public.setlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  audio_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

-- Rehearsals policies
CREATE POLICY "Band members can view rehearsals"
ON public.rehearsals FOR SELECT
USING (public.has_role(auth.uid(), 'band_member') OR public.has_role(auth.uid(), 'band_leader'));

CREATE POLICY "Band leaders can manage rehearsals"
ON public.rehearsals FOR ALL
USING (auth.uid() = band_leader_id);

-- Messages policies
CREATE POLICY "Band members can view messages"
ON public.messages FOR SELECT
USING (public.has_role(auth.uid(), 'band_member') OR public.has_role(auth.uid(), 'band_leader'));

CREATE POLICY "Band members can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id AND (public.has_role(auth.uid(), 'band_member') OR public.has_role(auth.uid(), 'band_leader')));

-- Gig members policies
CREATE POLICY "Band members can view gig responses"
ON public.gig_members FOR SELECT
USING (public.has_role(auth.uid(), 'band_member') OR public.has_role(auth.uid(), 'band_leader'));

CREATE POLICY "Band members can manage their responses"
ON public.gig_members FOR ALL
USING (auth.uid() = member_id);

CREATE POLICY "Band leaders can manage gig members"
ON public.gig_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.gigs
    WHERE gigs.id = gig_members.gig_id
    AND gigs.user_id = auth.uid()
  )
);

-- Setlists policies
CREATE POLICY "Band members can view setlists"
ON public.setlists FOR SELECT
USING (public.has_role(auth.uid(), 'band_member') OR public.has_role(auth.uid(), 'band_leader'));

CREATE POLICY "Band leaders can manage their setlists"
ON public.setlists FOR ALL
USING (auth.uid() = band_leader_id);

-- Setlist songs policies
CREATE POLICY "Band members can view setlist songs"
ON public.setlist_songs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.setlists
    WHERE setlists.id = setlist_songs.setlist_id
  )
);

CREATE POLICY "Band leaders can manage setlist songs"
ON public.setlist_songs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.setlists
    WHERE setlists.id = setlist_songs.setlist_id
    AND setlists.band_leader_id = auth.uid()
  )
);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('setlist-audio', 'setlist-audio', true);

-- Storage policies for audio files
CREATE POLICY "Band leaders can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'setlist-audio' AND
  public.has_role(auth.uid(), 'band_leader')
);

CREATE POLICY "Everyone can view audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'setlist-audio');

-- Add triggers for updated_at
CREATE TRIGGER update_rehearsals_updated_at
BEFORE UPDATE ON public.rehearsals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gig_members_updated_at
BEFORE UPDATE ON public.gig_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_setlists_updated_at
BEFORE UPDATE ON public.setlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();