
ALTER TABLE public.booking_manager_payments
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS notes text;

-- Ensure unique constraint exists for upsert key used by app
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_manager_payments_payer_source_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.booking_manager_payments
        ADD CONSTRAINT booking_manager_payments_payer_source_unique
        UNIQUE (booking_manager_id, source, source_id, artist_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;
