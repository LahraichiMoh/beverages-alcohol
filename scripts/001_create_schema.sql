-- Create tables for the Spin and Win app

-- Admins table
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.admins enable row level security;

create policy "Admins can view their own data"
  on public.admins for select
  using (auth.uid() = id);

-- Gifts table (for admin to manage prizes)
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_winners integer not null default 1,
  current_winners integer not null default 0,
  emoji text default '🎁',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid not null references public.admins(id) on delete cascade
);

alter table public.gifts enable row level security;

create policy "Everyone can view gifts"
  on public.gifts for select
  using (true);

create policy "Admins can insert gifts"
  on public.gifts for insert
  with check (auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

create policy "Admins can update their gifts"
  on public.gifts for update
  using (auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

create policy "Admins can delete their gifts"
  on public.gifts for delete
  using (auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

-- Participants table
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  agreed_to_terms boolean not null default false,
  won boolean not null default false,
  prize_id uuid references public.gifts(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.participants enable row level security;

-- Allow public to create participants
create policy "Anyone can create participants"
  on public.participants for insert
  with check (true);

-- Allow admins to view all participants
create policy "Admins can view participants"
  on public.participants for select
  using (EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

-- Allow admins to update participants
create policy "Admins can update participants"
  on public.participants for update
  using (EXISTS (
    SELECT 1 FROM public.admins WHERE id = auth.uid()
  ));

-- Create indexes for performance
create index if not exists idx_participants_code on public.participants(code);
create index if not exists idx_gifts_created_by on public.gifts(created_by);
