-- Add phone column to participant_details table
ALTER TABLE public.participant_details ADD COLUMN IF NOT EXISTS phone TEXT;
