
CREATE TABLE public.booking_manager_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_manager_id uuid NOT NULL,
  source text NOT NULL,
  source_id uuid NOT NULL,
  artist_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_manager_id, source, source_id, artist_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_manager_payments TO authenticated;
GRANT ALL ON public.booking_manager_payments TO service_role;

ALTER TABLE public.booking_manager_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage their payment records"
ON public.booking_manager_payments
FOR ALL
TO authenticated
USING (auth.uid() = booking_manager_id)
WITH CHECK (auth.uid() = booking_manager_id);

CREATE TRIGGER update_booking_manager_payments_updated_at
BEFORE UPDATE ON public.booking_manager_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
