DROP POLICY IF EXISTS "Performer can edit their requests" ON public.booking_requests;
CREATE POLICY "Performer can edit their requests"
ON public.booking_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = performer_id
  OR (performer_email IS NOT NULL AND lower(performer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))
)
WITH CHECK (
  auth.uid() = performer_id
  OR (performer_email IS NOT NULL AND lower(performer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))
);

DROP POLICY IF EXISTS "Super admins can edit all requests" ON public.booking_requests;
CREATE POLICY "Super admins can edit all requests"
ON public.booking_requests
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));