-- Add color column to gifts for spinner segment styling
ALTER TABLE public.gifts
ADD COLUMN IF NOT EXISTS color text DEFAULT '#D4A017';

