
ALTER TABLE public.booking_manager_payments
  ADD COLUMN IF NOT EXISTS confirmation_token uuid,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_email_at_send text;

CREATE UNIQUE INDEX IF NOT EXISTS booking_manager_payments_conf_token_idx
  ON public.booking_manager_payments(confirmation_token)
  WHERE confirmation_token IS NOT NULL;
