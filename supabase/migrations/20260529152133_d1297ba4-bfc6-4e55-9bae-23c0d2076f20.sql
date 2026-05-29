
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  band_id uuid,
  email text,
  status text,
  expires_at timestamptz,
  band_name text,
  band_description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bi.id, bi.band_id, bi.email, bi.status, bi.expires_at,
         b.name, b.description
  FROM public.band_invitations bi
  JOIN public.bands b ON b.id = bi.band_id
  WHERE bi.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;
