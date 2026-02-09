-- Add abstract and bullets for structured enrichment output
alter table public.items
  add column if not exists abstract text,
  add column if not exists bullets jsonb;
