CREATE POLICY "Booking managers can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'booking_manager'::public.app_role));