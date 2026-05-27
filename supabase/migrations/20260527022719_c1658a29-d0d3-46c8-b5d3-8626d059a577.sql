
DROP POLICY IF EXISTS "Performer can view their requests" ON public.booking_requests;
CREATE POLICY "Performer can view their requests"
ON public.booking_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = performer_id
  OR (performer_email IS NOT NULL AND lower(performer_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
);

DROP POLICY IF EXISTS "Performer can respond to pending requests" ON public.booking_requests;
CREATE POLICY "Performer can respond to pending requests"
ON public.booking_requests
FOR UPDATE
TO authenticated
USING (
  (
    auth.uid() = performer_id
    OR (performer_email IS NOT NULL AND lower(performer_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  AND status = 'pending'
  AND expires_at > now()
);
