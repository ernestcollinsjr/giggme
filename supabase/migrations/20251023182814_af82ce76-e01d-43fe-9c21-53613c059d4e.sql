-- Add detailed information fields to tour_crew_members table
ALTER TABLE public.tour_crew_members
ADD COLUMN flight_confirmation TEXT,
ADD COLUMN hotel_name TEXT,
ADD COLUMN hotel_address TEXT,
ADD COLUMN hotel_room_number TEXT,
ADD COLUMN hotel_check_in_time TEXT,
ADD COLUMN per_diem_info TEXT,
ADD COLUMN ticket_purchase_responsibility TEXT DEFAULT 'manager',
ADD COLUMN venue_amenities TEXT,
ADD COLUMN nearby_services TEXT;