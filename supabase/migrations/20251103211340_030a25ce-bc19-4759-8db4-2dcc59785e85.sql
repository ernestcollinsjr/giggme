-- Create band_invitations table
CREATE TABLE public.band_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(band_id, email)
);

-- Enable RLS
ALTER TABLE public.band_invitations ENABLE ROW LEVEL SECURITY;

-- Band leaders can view and create invitations for their bands
CREATE POLICY "Band leaders can manage invitations"
ON public.band_invitations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_invitations.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Anyone can view invitations sent to their email
CREATE POLICY "Users can view invitations sent to them"
ON public.band_invitations
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Create band_members table to track band membership
CREATE TABLE public.band_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(band_id, member_id)
);

-- Enable RLS
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;

-- Band leaders and members can view band members
CREATE POLICY "Band members viewable by band leader and members"
ON public.band_members
FOR SELECT
TO authenticated
USING (
  member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_members.band_id
    AND bands.band_leader_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = band_members.band_id
    AND bm.member_id = auth.uid()
  )
);

-- Band leaders can add members
CREATE POLICY "Band leaders can add members"
ON public.band_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_members.band_id
    AND bands.band_leader_id = auth.uid()
  )
);

-- Band leaders can remove members
CREATE POLICY "Band leaders can remove members"
ON public.band_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands
    WHERE bands.id = band_members.band_id
    AND bands.band_leader_id = auth.uid()
  )
);