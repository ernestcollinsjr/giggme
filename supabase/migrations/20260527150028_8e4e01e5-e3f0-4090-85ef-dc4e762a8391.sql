ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS preferred_pay numeric,
  ADD COLUMN IF NOT EXISTS preferred_pay_hours numeric;