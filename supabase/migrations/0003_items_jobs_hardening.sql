-- Items: add error column for last failure
alter table public.items
  add column if not exists error text;

-- Jobs: add attempts counter
alter table public.jobs
  add column if not exists attempts int not null default 0;

-- Atomic job claim: set running + increment attempts
create or replace function public.claim_job(p_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.jobs
  set status = 'running', started_at = now(), attempts = attempts + 1
  where id = p_id and status = 'queued';
  return found;
end;
$$;
