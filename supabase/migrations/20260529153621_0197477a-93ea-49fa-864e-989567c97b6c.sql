
ALTER TABLE public.band_invitations DROP CONSTRAINT IF EXISTS band_invitations_role_check;
ALTER TABLE public.band_invitations
  ADD CONSTRAINT band_invitations_role_check
  CHECK (role IN ('member','entertainer','admin'));
