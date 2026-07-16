-- Global Nominatim geocode cache (cross-user).
-- Used by geocode-proxy Edge Function; clients never call Nominatim directly.

create table if not exists public.geocode_cache (
  place_name_normalized text primary key,
  lat double precision,
  lng double precision,
  resolved_at timestamptz default now(),
  raw_response jsonb
);

comment on table public.geocode_cache is
  'Cross-user cache of Nominatim geocode results keyed by normalized place name';

alter table public.geocode_cache enable row level security;

-- Readable by authenticated users (cache hits); writes via service role in Edge Function.
create policy "geocode_cache_select_authenticated"
  on public.geocode_cache
  for select
  to authenticated
  using (true);
