DELETE FROM public.band_invitations WHERE band_id IN (SELECT id FROM public.bands WHERE name <> 'GiggMe Group');
DELETE FROM public.band_members WHERE band_id IN (SELECT id FROM public.bands WHERE name <> 'GiggMe Group');
DELETE FROM public.bands WHERE name <> 'GiggMe Group';