
ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS technical_rider text,
  ADD COLUMN IF NOT EXISTS hospitality_rider text,
  ADD COLUMN IF NOT EXISTS stage_plot_url text,
  ADD COLUMN IF NOT EXISTS input_list text,
  ADD COLUMN IF NOT EXISTS monitor_mix_preferences text,
  ADD COLUMN IF NOT EXISTS backline_requirements text,
  ADD COLUMN IF NOT EXISTS rider_notes text;
