-- Applied to Supabase project "je-apps" (ugageqklogrispkncrnp) on 2026-11-04.
-- Shared data for the Car Parking Finder. Anyone using the app (anon key) can
-- read and add, but nobody can edit or delete through the API.

create table public.parking_reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sign','construction','full','free')),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  note text check (char_length(note) <= 500),
  photo_path text check (char_length(photo_path) <= 200),
  sign_reading jsonb,               -- filled only by the read-sign Edge Function (service role)
  created_at timestamptz not null default now()
);
create index reports_geo_time on public.parking_reports (lat, lon, created_at desc);

create table public.parking_checkins (
  id bigint generated always as identity primary key,
  spot text not null check (char_length(spot) <= 40),
  found boolean not null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  created_at timestamptz not null default now()
);
create index checkins_geo on public.parking_checkins (lat, lon);
create index checkins_spot on public.parking_checkins (spot);

alter table public.parking_reports enable row level security;
alter table public.parking_checkins enable row level security;

create policy "anyone can read reports" on public.parking_reports for select to anon, authenticated using (true);
create policy "anyone can add reports" on public.parking_reports for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute' and sign_reading is null);
create policy "anyone can read checkins" on public.parking_checkins for select to anon, authenticated using (true);
create policy "anyone can add checkins" on public.parking_checkins for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute');

grant select, insert on public.parking_reports, public.parking_checkins to anon, authenticated;

-- Photos: public to view, anyone can upload images up to 2 MB, no overwrite/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', true, 2097152, array['image/jpeg','image/png','image/webp']);

create policy "anyone can upload report photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'report-photos');
