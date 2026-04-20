ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

DO $$
DECLARE
  default_campaign_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.venues WHERE campaign_id IS NULL) THEN
    SELECT id INTO default_campaign_id
    FROM public.campaigns
    WHERE slug = 'default'
    LIMIT 1;

    IF default_campaign_id IS NULL THEN
      INSERT INTO public.campaigns (name, slug, description, theme)
      VALUES (
        'Campagne par défaut',
        'default',
        'Campagne générée automatiquement pour les données existantes',
        '{
          "primaryColor": "#7f1d1d",
          "secondaryColor": "#facc15",
          "logoUrl": "/casa_logo.png",
          "backgroundUrl": "/flag-back.jpg"
        }'::jsonb
      )
      RETURNING id INTO default_campaign_id;
    END IF;

    UPDATE public.venues
    SET campaign_id = default_campaign_id
    WHERE campaign_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.venues
ALTER COLUMN campaign_id SET NOT NULL;

ALTER TABLE public.venues
DROP CONSTRAINT IF EXISTS venues_city_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_campaign_city_name
ON public.venues (campaign_id, city_id, name);

CREATE INDEX IF NOT EXISTS idx_venues_campaign_id
ON public.venues (campaign_id);
