-- Grant credits for one-time credit pack purchase. Same semantics as grant_credits_admin but reason 'credit_pack'.
create or replace function public.grant_credits_pack(p_user_id uuid, p_amount int)
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
    50,
    date_trunc('month', now()) + interval '1 month',
    now(),
    now()
  )
  on conflict (user_id) do update set
    balance = user_credits.balance + p_amount,
    updated_at = now();

  insert into credit_ledger (user_id, delta, reason, created_at)
  values (p_user_id, p_amount, 'credit_pack', now());
end;
$$;
