-- Marketing opt-in: queryable in public.user_settings
alter table public.user_settings
  add column if not exists marketing_emails boolean not null default false;
