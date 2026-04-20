-- Add image_url column to gifts table for prize images
ALTER TABLE public.gifts
ADD COLUMN IF NOT EXISTS image_url text;

