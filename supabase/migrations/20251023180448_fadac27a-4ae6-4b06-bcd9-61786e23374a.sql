-- First, let's ensure there are no conflicting constraints
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tour_crew_members_crew_member_id_fkey'
    ) THEN
        ALTER TABLE public.tour_crew_members
        DROP CONSTRAINT tour_crew_members_crew_member_id_fkey;
    END IF;
END $$;

-- Now add the foreign key properly
ALTER TABLE public.tour_crew_members
ADD CONSTRAINT tour_crew_members_crew_member_id_fkey
FOREIGN KEY (crew_member_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;