-- User credits: balance, monthly grant, reset date. Plan-ready (monthly_grant per tier later).
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0,
  monthly_grant int not null,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

create policy "user_credits: user can select own" on public.user_credits
  for select using (auth.uid() = user_id);

-- Ledger: every grant and spend for auditing.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  job_id uuid references public.jobs(id) on delete set null,
  item_id uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb
);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger: user can select own" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- Atomic monthly grant: add monthly_grant to balance and advance reset_at when reset_at <= now().
create or replace function public.grant_monthly_credits_if_due(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_next_reset timestamptz;
begin
  select balance, monthly_grant, reset_at into v_row
  from user_credits
  where user_id = p_user_id for update;

  if not found or v_row.reset_at > now() then
    return;
  end if;

  v_next_reset := date_trunc('month', v_row.reset_at) + interval '1 month';

  update user_credits
  set balance = balance + v_row.monthly_grant,
      reset_at = v_next_reset,
      updated_at = now()
  where user_id = p_user_id;

  insert into credit_ledger (user_id, delta, reason, created_at)
  values (p_user_id, v_row.monthly_grant, 'monthly_grant', now());
end;
$$;

-- Atomic spend: deduct amount if balance >= amount, record in ledger. Returns true if spent.
create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_job_id uuid default null,
  p_item_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    return false;
  end if;

  update user_credits
  set balance = balance - p_amount,
      updated_at = now()
  where user_id = p_user_id and balance >= p_amount;

  if not found then
    return false;
  end if;

  insert into credit_ledger (user_id, delta, reason, job_id, item_id, created_at)
  values (p_user_id, -p_amount, p_reason, p_job_id, p_item_id, now());

  return true;
end;
$$;

-- Admin grant: add credits and record in ledger. Creates user_credits row if missing.
create or replace function public.grant_credits_admin(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    return;
  end if;

  insert into user_credits (user_id, balance, monthly_grant, reset_at, created_at, updated_at)
  values (
    p_user_id,
    p_amount,
    100,
    date_trunc('month', now()) + interval '1 month',
    now(),
    now()
  )
  on conflict (user_id) do update set
    balance = user_credits.balance + p_amount,
    updated_at = now();

  insert into credit_ledger (user_id, delta, reason, created_at)
  values (p_user_id, p_amount, 'admin_grant', now());
end;
$$;
