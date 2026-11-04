-- Applied to Supabase project "je-apps" (ugageqklogrispkncrnp) on 2026-11-04.
-- Truck data collection: official truck parking sites, live occupancy over time,
-- anonymous planned stops (demand), and raw copies of everything we download.
-- Filled by the Edge Function "collect-truck-data" (runs on a schedule, see below)
-- and by the Break Planner app.

-- Truck parking sites from official/open sources (Autobahn GmbH, Trafikverket, ...)
create table public.truck_sites (
  id text primary key,                         -- "<source>:<source id>"
  source text not null,                        -- autobahn | trafikverket | sid | ...
  name text,
  lat double precision not null,
  lon double precision not null,
  country text,
  road text,
  capacity_hgv int,
  features jsonb not null default '[]',
  is_blocked boolean not null default false,
  raw jsonb,
  updated_at timestamptz not null default now()
);
create index truck_sites_geo on public.truck_sites (lat, lon);

-- Occupancy over time (live feeds). One row per site per reading.
create table public.truck_site_status (
  id bigint generated always as identity primary key,
  site_id text not null,
  source text not null,
  status text check (status in ('free','few','full','closed','unknown')),
  occupied int,
  capacity int,
  observed_at timestamptz not null default now()
);
create index truck_site_status_site_time on public.truck_site_status (site_id, observed_at desc);

-- Anonymous planned stops from the Break Planner: which stop, which kind,
-- planned arrival time. No user id, no start or destination.
create table public.planned_stops (
  id bigint generated always as identity primary key,
  place_id text not null check (char_length(place_id) <= 60),
  kind text not null check (kind in ('break','rest')),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  arrive_at timestamptz not null,
  leave_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (arrive_at between created_at - interval '1 hour' and created_at + interval '4 days'),
  check (leave_at >= arrive_at and leave_at <= arrive_at + interval '13 hours')
);
create index planned_stops_geo_time on public.planned_stops (lat, lon, arrive_at);

-- Everything we download, as it came, so nothing is lost and we can re-parse later.
create table public.raw_snapshots (
  id bigint generated always as identity primary key,
  source text not null,
  fetched_at timestamptz not null default now(),
  ok boolean not null default true,
  note text,
  payload jsonb
);
create index raw_snapshots_source_time on public.raw_snapshots (source, fetched_at desc);

alter table public.truck_sites enable row level security;
alter table public.truck_site_status enable row level security;
alter table public.planned_stops enable row level security;
alter table public.raw_snapshots enable row level security;

-- Sites and statuses: anyone can read, only the collector (service role) writes.
create policy "read truck sites" on public.truck_sites for select to anon, authenticated using (true);
create policy "read truck site status" on public.truck_site_status for select to anon, authenticated using (true);
grant select on public.truck_sites, public.truck_site_status to anon, authenticated;

-- Planned stops: anyone can read and add, nobody can edit or delete.
create policy "read planned stops" on public.planned_stops for select to anon, authenticated using (true);
create policy "add planned stops" on public.planned_stops for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute');
grant select, insert on public.planned_stops to anon, authenticated;

-- raw_snapshots: no access for app users (service role only).

-- How full is each place, by weekday and hour? Combines driver reports and
-- live feeds into one 0..1 "fullness" score (0 = empty, 1 = full).
create view public.truck_fullness_by_hour with (security_invoker = true) as
with obs as (
  select place_id as site_id, created_at as at,
         case status when 'free' then 0.1 when 'few' then 0.6 when 'full' then 1.0 end as fullness
  from public.truck_parking_reports
  union all
  select site_id, observed_at,
         case when capacity > 0 and occupied is not null then least(1.0, occupied::numeric / capacity)
              when status = 'free' then 0.1 when status = 'few' then 0.6 when status = 'full' then 1.0 end
  from public.truck_site_status
  where status is distinct from 'unknown' and status is distinct from 'closed'
)
select site_id,
       extract(isodow from at at time zone 'Europe/Stockholm')::int as dow,
       extract(hour from at at time zone 'Europe/Stockholm')::int as hour,
       count(*)::int as n,
       round(avg(fullness), 2) as fullness
from obs
where at > now() - interval '180 days' and fullness is not null
group by 1, 2, 3;
grant select on public.truck_fullness_by_hour to anon, authenticated;

-- Scheduled collection (pg_cron + pg_net call the Edge Function).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedules (run once with cron.schedule, applied 2026-11-04). The anon key in
-- the header is the public one from shared/supabase-config.js.
--   truck-data-autobahn-daily      '17 3 * * *'    body {"source":"autobahn"}
--   truck-data-trafikverket-10min  '*/10 * * * *'  body {"source":"trafikverket"}  (no-op until the key is set)
-- select cron.schedule('<name>', '<schedule>', $$ select net.http_post(
--   url := 'https://ugageqklogrispkncrnp.supabase.co/functions/v1/collect-truck-data',
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon key>"}'::jsonb,
--   body := '{"source":"<source>"}'::jsonb, timeout_milliseconds := 150000); $$);
