-- Stripe webhook event idempotency: prevent double-processing on retries.
create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_event_id_idx
  on public.stripe_webhook_events (event_id);

-- Only service role (admin) can access; no RLS policies for user access.
alter table public.stripe_webhook_events enable row level security;
