-- Migrate venues to be linked directly to cities, then remove regions.

ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE;

UPDATE public.venues v
SET city_id = r.city_id
FROM public.regions r
WHERE v.city_id IS NULL
  AND v.region_id = r.id;

ALTER TABLE public.venues
ALTER COLUMN city_id SET NOT NULL;

ALTER TABLE public.venues
DROP CONSTRAINT IF EXISTS venues_region_id_name_key;

DO $$
BEGIN
  ALTER TABLE public.venues
  ADD CONSTRAINT venues_city_id_name_key UNIQUE (city_id, name);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

ALTER TABLE public.venues
DROP COLUMN IF EXISTS region_id;

ALTER TABLE public.participants
DROP COLUMN IF EXISTS region_id;

ALTER TABLE public.participants
DROP COLUMN IF EXISTS region_name;

DROP TABLE IF EXISTS public.regions CASCADE;
