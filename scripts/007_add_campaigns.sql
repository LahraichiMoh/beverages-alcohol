-- Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  theme jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Everyone can view active campaigns"
  ON public.campaigns FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all campaigns"
  ON public.campaigns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

-- Add campaign_id to gifts
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Add campaign_id to participants
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Create a default campaign for existing data
DO $$
DECLARE
  default_campaign_id uuid;
BEGIN
  -- Check if there are any existing gifts or participants that need migration
  IF EXISTS (SELECT 1 FROM public.gifts WHERE campaign_id IS NULL) OR EXISTS (SELECT 1 FROM public.participants WHERE campaign_id IS NULL) THEN
    
    -- Create default campaign
    INSERT INTO public.campaigns (name, slug, description, theme)
    VALUES ('Campagne par défaut', 'default', 'Campagne générée automatiquement pour les données existantes', 
    '{
      "primaryColor": "#7f1d1d", 
      "secondaryColor": "#facc15", 
      "logoUrl": "/casa_logo.png", 
      "backgroundUrl": "/flag-back.jpg"
    }'::jsonb)
    RETURNING id INTO default_campaign_id;

    -- Update existing gifts
    UPDATE public.gifts SET campaign_id = default_campaign_id WHERE campaign_id IS NULL;

    -- Update existing participants
    UPDATE public.participants SET campaign_id = default_campaign_id WHERE campaign_id IS NULL;
    
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gifts_campaign_id ON public.gifts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_participants_campaign_id ON public.participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON public.campaigns(slug);
