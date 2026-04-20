-- Campaign access credentials
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS access_username text;

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS access_password text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_access_username
ON public.campaigns(access_username)
WHERE access_username IS NOT NULL;

-- Venues (restau/bar) linked to cities
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(city_id, name)
);

ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read venues" ON public.venues;
CREATE POLICY "Everyone can read venues"
  ON public.venues FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage venues" ON public.venues;
CREATE POLICY "Admins can manage venues"
  ON public.venues
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Gift stock by venue (restau/bar)
CREATE TABLE IF NOT EXISTS public.gift_venue_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  max_winners INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(gift_id, venue_id)
);

ALTER TABLE public.gift_venue_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on gift_venue_limits" ON public.gift_venue_limits;
DROP POLICY IF EXISTS "Public read access on gift_venue_limits" ON public.gift_venue_limits;

CREATE POLICY "Admins can do everything on gift_venue_limits"
  ON public.gift_venue_limits
  FOR ALL
  USING (public.is_admin());

CREATE POLICY "Public read access on gift_venue_limits"
  ON public.gift_venue_limits
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_gift_venue_limits_gift_id ON public.gift_venue_limits(gift_id);
CREATE INDEX IF NOT EXISTS idx_gift_venue_limits_venue_id ON public.gift_venue_limits(venue_id);

UPDATE public.gifts
SET max_winners = 0
WHERE max_winners IS DISTINCT FROM 0;

ALTER TABLE public.gifts
ALTER COLUMN max_winners SET DEFAULT 0;

-- Store selected location metadata on participant row
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL;

ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS venue_type text;

-- Seed test venues for Casablanca
DO $$
DECLARE
  casa_city_id uuid;
BEGIN
  SELECT id INTO casa_city_id
  FROM public.cities
  WHERE name ILIKE 'Casablanca'
  LIMIT 1;

  IF casa_city_id IS NOT NULL THEN
    INSERT INTO public.venues (city_id, name, type, stock)
    VALUES
      (casa_city_id, 'Le Nord Bar', 'bar', 50),
      (casa_city_id, 'Nord Coffee', 'restau', 30),
      (casa_city_id, 'Sud Lounge', 'bar', 40),
      (casa_city_id, 'Casa Sud Restaurant', 'restau', 25),
      (casa_city_id, 'Est Taproom', 'bar', 35),
      (casa_city_id, 'Est Bistro', 'restau', 20),
      (casa_city_id, 'Ouest Bar', 'bar', 45),
      (casa_city_id, 'Ouest Grill', 'restau', 28)
    ON CONFLICT (city_id, name) DO NOTHING;
  END IF;
END $$;
