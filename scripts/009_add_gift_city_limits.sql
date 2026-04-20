-- Create is_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create table
CREATE TABLE IF NOT EXISTS public.gift_city_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  max_winners INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(gift_id, city_id)
);

-- Add RLS
ALTER TABLE public.gift_city_limits ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid errors on re-run
DROP POLICY IF EXISTS "Admins can do everything on gift_city_limits" ON public.gift_city_limits;
DROP POLICY IF EXISTS "Public read access" ON public.gift_city_limits;

CREATE POLICY "Admins can do everything on gift_city_limits"
  ON public.gift_city_limits
  FOR ALL
  USING (public.is_admin());

CREATE POLICY "Public read access"
  ON public.gift_city_limits
  FOR SELECT
  USING (true);
