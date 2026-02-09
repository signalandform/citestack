-- Add extracted_at and enriched_at for processing timeline
alter table public.items
  add column if not exists extracted_at timestamptz null,
  add column if not exists enriched_at timestamptz null;
