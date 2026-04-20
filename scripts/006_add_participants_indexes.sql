create index if not exists idx_participants_campaign_created_at on public.participants(campaign_id, created_at desc);
create index if not exists idx_participants_campaign_won on public.participants(campaign_id, won);
create index if not exists idx_participants_campaign_city on public.participants(campaign_id, city);
create index if not exists idx_participants_campaign_name on public.participants(campaign_id, name);
create index if not exists idx_participants_campaign_prize_id on public.participants(campaign_id, prize_id);
