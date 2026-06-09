CREATE TABLE public.favorite_performers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, performer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_performers TO authenticated;
GRANT ALL ON public.favorite_performers TO service_role;

ALTER TABLE public.favorite_performers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
ON public.favorite_performers
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_favorite_performers_user ON public.favorite_performers(user_id);