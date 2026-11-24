-- NOT YET APPLIED to Supabase project "je-apps" (ugageqklogrispkncrnp): it was waiting for
-- approval on 2026-11-04. Until it is, check-ins are saved as normal reports (the app falls back).
-- Check-ins: a driver taps "I'm parked here", the phone's GPS confirms they are
-- within 500 m of the stop, and they say how full it is. We store only the
-- distance to the stop (not the driver's position).
alter table public.truck_parking_reports
  add column verified boolean not null default false,
  add column distance_m int check (distance_m between 0 and 1000);

drop policy "anyone can add truck reports" on public.truck_parking_reports;
create policy "anyone can add truck reports" on public.truck_parking_reports
  for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute'
              and (not verified or (distance_m is not null and distance_m <= 500)));

-- GPS-confirmed check-ins count twice as much in the fullness history.
create or replace view public.truck_fullness_by_hour with (security_invoker = true) as
with obs as (
  select place_id as site_id, created_at as at,
         case status when 'free' then 0.1 when 'few' then 0.6 when 'full' then 1.0 end as fullness,
         case when verified then 2 else 1 end as w
  from public.truck_parking_reports
  union all
  select site_id, observed_at,
         case when capacity > 0 and occupied is not null then least(1.0, occupied::numeric / capacity)
              when status = 'free' then 0.1 when status = 'few' then 0.6 when status = 'full' then 1.0 end,
         1
  from public.truck_site_status
  where status is distinct from 'unknown' and status is distinct from 'closed'
)
select site_id,
       extract(isodow from at at time zone 'Europe/Stockholm')::int as dow,
       extract(hour from at at time zone 'Europe/Stockholm')::int as hour,
       sum(w)::int as n,
       round(sum(fullness * w) / sum(w), 2) as fullness
from obs
where at > now() - interval '180 days' and fullness is not null
group by 1, 2, 3;
grant select on public.truck_fullness_by_hour to anon, authenticated;
