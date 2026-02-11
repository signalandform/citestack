-- Stripe: link user_credits to Stripe customer and subscription for billing.
alter table public.user_credits
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text;

create unique index if not exists user_credits_stripe_customer_id_key
  on public.user_credits (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.user_credits.stripe_customer_id is 'Stripe customer id; set on first checkout or customer create';
comment on column public.user_credits.stripe_subscription_id is 'Current Stripe subscription id; updated by webhooks';
comment on column public.user_credits.stripe_subscription_status is 'active|canceled|past_due etc; updated by webhooks';
