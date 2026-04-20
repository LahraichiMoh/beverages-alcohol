-- Add city column to participants table
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS city TEXT;
