-- Add campaign_id to gifts table
ALTER TABLE gifts 
ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_gifts_campaign_id ON gifts(campaign_id);

-- Update RLS policies for gifts if necessary (assuming admin can see all, but public might need checks)
-- This depends on existing policies. Usually "public can read gifts" is enough, but maybe filter by campaign?
-- For now, we assume the backend filters by campaign_id when fetching.
