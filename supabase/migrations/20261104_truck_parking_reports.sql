-- Applied to Supabase project "je-apps" (ugageqklogrispkncrnp) on 2026-11-04.
-- Truck Break Planner: drivers report how full a truck stop is right now.
-- Anyone using the app (anon key) can read and add, nobody can edit or delete.

create table public.truck_parking_reports (
  id bigint generated always as identity primary key,
  place_id text not null check (char_length(place_id) <= 40),   -- OpenStreetMap id, e.g. "way/12345"
  status text not null check (status in ('free','few','full')),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  created_at timestamptz not null default now()
);
create index truck_reports_geo_time on public.truck_parking_reports (lat, lon, created_at desc);
create index truck_reports_place on public.truck_parking_reports (place_id, created_at desc);

alter table public.truck_parking_reports enable row level security;

create policy "anyone can read truck reports" on public.truck_parking_reports
  for select to anon, authenticated using (true);
create policy "anyone can add truck reports" on public.truck_parking_reports
  for insert to anon, authenticated with check (created_at > now() - interval '1 minute');

grant select, insert on public.truck_parking_reports to anon, authenticated;
