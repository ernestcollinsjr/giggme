-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('band', 'manager');

-- Create enum for instruments
CREATE TYPE public.instrument_type AS ENUM ('guitar', 'bass', 'drums', 'vocals', 'keyboard', 'saxophone', 'trumpet', 'other');

-- Create enum for gig status
CREATE TYPE public.gig_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  name TEXT NOT NULL,
  bio TEXT,
  instrument instrument_type,
  photo_url TEXT,
  rider_notes TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create gigs table
CREATE TABLE public.gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  status gig_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on gigs
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

-- Gigs policies
CREATE POLICY "Users can view all gigs"
  ON public.gigs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own gigs"
  ON public.gigs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gigs"
  ON public.gigs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gigs"
  ON public.gigs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'role')::app_role,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gigs_updated_at
  BEFORE UPDATE ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gigs;