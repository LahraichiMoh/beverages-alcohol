-- Add is_prize column to gifts table
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS is_prize BOOLEAN DEFAULT true;
