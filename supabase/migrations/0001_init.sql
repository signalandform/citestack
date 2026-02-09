-- Citestack initial schema (v0)
-- Run in Supabase SQL editor.

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_type text not null check (source_type in ('url','paste','file')),
  url text,
  domain text,
  title text,
  raw_text text,
  cleaned_text text,
  file_path text,
  mime_type text,
  original_filename text,
  status text not null default 'captured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs (simple queue)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid references public.items(id) on delete cascade,
  type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  run_after timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.item_tags (
  item_id uuid references public.items(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

-- Quotes
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid not null references public.items(id) on delete cascade,
  quote text not null,
  why_it_matters text,
  start_offset int,
  end_offset int,
  created_at timestamptz not null default now()
);

-- Embeddings (for Week 3)
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid not null references public.items(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (item_id, chunk_index)
);

-- Invite codes
create table if not exists public.invite_codes (
  code text primary key,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.invite_codes(code) on delete restrict,
  email text not null,
  user_id uuid,
  redeemed_at timestamptz not null default now()
);

-- RLS
alter table public.items enable row level security;
alter table public.jobs enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.quotes enable row level security;
alter table public.embeddings enable row level security;

-- Per-user policies
drop policy if exists "items: user can CRUD own" on public.items;
create policy "items: user can CRUD own" on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "jobs: user can CRUD own" on public.jobs;
create policy "jobs: user can CRUD own" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tags: user can CRUD own" on public.tags;
create policy "tags: user can CRUD own" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "item_tags: user can CRUD via item ownership" on public.item_tags;
create policy "item_tags: user can CRUD via item ownership" on public.item_tags
  for all using (
    exists (
      select 1 from public.items i
      where i.id = item_tags.item_id and i.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.items i
      where i.id = item_tags.item_id and i.user_id = auth.uid()
    )
  );

drop policy if exists "quotes: user can CRUD own" on public.quotes;
create policy "quotes: user can CRUD own" on public.quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "embeddings: user can CRUD own" on public.embeddings;
create policy "embeddings: user can CRUD own" on public.embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
