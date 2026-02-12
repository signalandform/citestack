-- Job retry: max_attempts and exponential backoff.
alter table public.jobs add column if not exists max_attempts int not null default 3;

-- claim_job: only claim if attempts < max_attempts.
create or replace function public.claim_job(p_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.jobs
  set status = 'running', started_at = now(), attempts = attempts + 1
  where id = p_id and status = 'queued' and attempts < max_attempts;
  return found;
end;
$$;

-- Refund credits (e.g. when compare fails after spend). Adds to balance and records in ledger.
create or replace function public.grant_credits_refund(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 or p_reason is null or p_reason = '' then
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
  values (p_user_id, p_amount, p_reason, now());
end;
$$;
