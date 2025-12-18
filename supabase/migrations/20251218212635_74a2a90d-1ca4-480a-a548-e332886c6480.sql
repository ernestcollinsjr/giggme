-- Add venue_owner role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'venue_owner';

-- Create venues table
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  description text,
  venue_type text, -- restaurant, bar, club, etc.
  capacity integer,
  lat numeric,
  lng numeric,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Venue preferred entertainers (their roster)
CREATE TABLE public.venue_preferred_entertainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  entertainer_id uuid NOT NULL,
  priority integer DEFAULT 1, -- 1 = highest priority for auto-suggest
  notes text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(venue_id, entertainer_id)
);

-- Booking status enum
CREATE TYPE public.booking_status AS ENUM (
  'pending',      -- venue requested, awaiting entertainer response
  'confirmed',    -- entertainer accepted
  'declined',     -- entertainer declined
  'cancelled',    -- venue or entertainer cancelled
  'callout',      -- entertainer called out
  'completed'     -- event happened
);

-- Entertainment bookings
CREATE TABLE public.entertainment_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  entertainer_id uuid NOT NULL,
  original_entertainer_id uuid, -- if this is a replacement booking
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  status booking_status NOT NULL DEFAULT 'pending',
  payment_amount numeric,
  payment_status text DEFAULT 'unpaid',
  notes text,
  venue_notes text, -- private notes from venue
  entertainer_notes text, -- notes from entertainer
  callout_reason text,
  is_recurring boolean DEFAULT false,
  recurring_schedule_id uuid, -- links to recurring schedule
  confirmation_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recurring schedules (e.g., "Jazz night every Friday")
CREATE TABLE public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  entertainer_id uuid NOT NULL,
  name text NOT NULL, -- "Friday Jazz Night"
  day_of_week integer NOT NULL, -- 0=Sunday, 6=Saturday
  start_time time NOT NULL,
  end_time time,
  payment_amount numeric,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- In-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL, -- booking_request, reminder, callout, confirmation, etc.
  related_id uuid, -- booking_id, etc.
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notification preferences
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT true,
  push_enabled boolean DEFAULT true,
  reminder_1_week boolean DEFAULT true,
  reminder_1_day boolean DEFAULT true,
  reminder_day_of boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_preferred_entertainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entertainment_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Venues policies
CREATE POLICY "Venue owners can manage their venues"
  ON public.venues FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Everyone can view venues"
  ON public.venues FOR SELECT
  USING (true);

-- Preferred entertainers policies
CREATE POLICY "Venue owners can manage preferred entertainers"
  ON public.venue_preferred_entertainers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Entertainers can see if they are preferred"
  ON public.venue_preferred_entertainers FOR SELECT
  USING (entertainer_id = auth.uid());

-- Bookings policies
CREATE POLICY "Venue owners can manage their bookings"
  ON public.entertainment_bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Entertainers can view and respond to their bookings"
  ON public.entertainment_bookings FOR SELECT
  USING (entertainer_id = auth.uid());

CREATE POLICY "Entertainers can update their booking responses"
  ON public.entertainment_bookings FOR UPDATE
  USING (entertainer_id = auth.uid());

-- Recurring schedules policies
CREATE POLICY "Venue owners can manage recurring schedules"
  ON public.recurring_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Entertainers can view their recurring schedules"
  ON public.recurring_schedules FOR SELECT
  USING (entertainer_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Notification preferences policies
CREATE POLICY "Users can manage their notification preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid());

-- Updated at triggers
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entertainment_bookings_updated_at
  BEFORE UPDATE ON public.entertainment_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bookings and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.entertainment_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;