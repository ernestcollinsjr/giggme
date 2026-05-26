CREATE POLICY "Booker can delete their requests"
ON public.booking_requests
FOR DELETE
TO authenticated
USING (auth.uid() = booker_id);

GRANT DELETE ON public.booking_requests TO authenticated;