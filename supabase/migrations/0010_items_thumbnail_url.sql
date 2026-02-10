-- Add thumbnail_url for URL item screenshots (e.g. from Microlink).
alter table public.items add column if not exists thumbnail_url text;
