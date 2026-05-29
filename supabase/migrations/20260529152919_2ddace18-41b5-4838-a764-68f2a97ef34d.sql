
ALTER TABLE public.band_invitations
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

ALTER TABLE public.band_invitations
  DROP CONSTRAINT IF EXISTS band_invitations_role_check;
ALTER TABLE public.band_invitations
  ADD CONSTRAINT band_invitations_role_check
  CHECK (role IN ('member','entertainer'));

DROP FUNCTION IF EXISTS public.get_invitation_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
 RETURNS TABLE(id uuid, band_id uuid, email text, status text, expires_at timestamp with time zone, band_name text, band_description text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT bi.id, bi.band_id, bi.email, bi.status, bi.expires_at,
         b.name, b.description, bi.role
  FROM public.band_invitations bi
  JOIN public.bands b ON b.id = bi.band_id
  WHERE bi.token = _token
  LIMIT 1;
$function$;
