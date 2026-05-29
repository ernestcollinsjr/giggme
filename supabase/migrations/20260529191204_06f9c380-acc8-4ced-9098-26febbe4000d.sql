CREATE POLICY "Booker can edit their requests"
ON public.booking_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = booker_id)
WITH CHECK (auth.uid() = booker_id);