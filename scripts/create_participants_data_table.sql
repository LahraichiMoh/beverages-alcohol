-- Create table for storing detailed participant information
CREATE TABLE IF NOT EXISTS public.participant_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL, -- 'Masculin', 'Féminin'
    age_range TEXT NOT NULL, -- '18-25', '26-35', etc.
    address TEXT,
    usual_product TEXT,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_participant_details_participant_id ON public.participant_details(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_details_campaign_id ON public.participant_details(campaign_id);

-- Set up RLS (Row Level Security)
ALTER TABLE public.participant_details ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for the spin page)
CREATE POLICY "Allow anonymous insert participant_details" 
ON public.participant_details FOR INSERT 
WITH CHECK (true);

-- Allow admins to view all data
CREATE POLICY "Allow admins to view participant_details" 
ON public.participant_details FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));
