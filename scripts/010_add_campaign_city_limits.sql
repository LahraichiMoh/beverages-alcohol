create table if not exists public.campaign_city_limits (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  max_winners integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(campaign_id, city_id)
);

alter table public.campaign_city_limits enable row level security;

create policy "Admins can view campaign city limits"
  on public.campaign_city_limits for select
  using (exists (select 1 from public.admins where id = auth.uid()));

create policy "Admins can insert campaign city limits"
  on public.campaign_city_limits for insert
  with check (exists (select 1 from public.admins where id = auth.uid()));

create policy "Admins can update campaign city limits"
  on public.campaign_city_limits for update
  using (exists (select 1 from public.admins where id = auth.uid()));

create policy "Admins can delete campaign city limits"
  on public.campaign_city_limits for delete
  using (exists (select 1 from public.admins where id = auth.uid()));
