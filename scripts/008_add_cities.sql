
-- Create cities table
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  password text NOT NULL, -- Storing simple password as requested for city access
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Everyone can read cities"
  ON public.cities FOR SELECT
  USING (true);

-- Seed Cities
INSERT INTO public.cities (name, username, password)
VALUES 
  ('Casablanca', 'casa', 'casa2024'),
  ('Rabat', 'rabat', 'rabat2024'),
  ('Marrakech', 'marrakech', 'kech2024'),
  ('Fes', 'fes', 'fes2024'),
  ('Tanger', 'tanger', 'tanger2024'),
  ('Agadir', 'agadir', 'agadir2024'),
  ('Oujda', 'oujda', 'oujda2024')
ON CONFLICT (username) DO NOTHING;
