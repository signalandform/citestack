-- Capture dedupe and idempotency: canonical URL, file hash, last_saved_at, idempotency keys.
alter table public.items
  add column if not exists url_canonical text,
  add column if not exists last_saved_at timestamptz,
  add column if not exists file_sha256 text;

-- One item per user per canonical URL (URL dedupe).
create unique index if not exists items_user_url_canonical_key
  on public.items (user_id, url_canonical)
  where source_type = 'url' and url_canonical is not null;

-- One item per user per file hash (file dedupe).
create unique index if not exists items_user_file_sha256_key
  on public.items (user_id, file_sha256)
  where source_type = 'file' and file_sha256 is not null;

-- Idempotency keys: (user_id, key) stores response for replay.
create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  request_fingerprint text,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.idempotency_keys enable row level security;

create policy "idempotency_keys: user can select and insert own" on public.idempotency_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
