-- Fix incorrect foreign key on gigs.band_id (was referencing gigs instead of bands)
ALTER TABLE public.gigs
  DROP CONSTRAINT IF EXISTS gigs_band_id_fkey;

ALTER TABLE public.gigs
  ADD CONSTRAINT gigs_band_id_fkey
  FOREIGN KEY (band_id)
  REFERENCES public.bands(id)
  ON DELETE SET NULL;