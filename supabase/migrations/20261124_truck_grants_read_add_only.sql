-- Applied to Supabase project "je-apps" (ugageqklogrispkncrnp) on 2026-11-24.
-- The truck tables were created with Supabase's default rights for the public roles (every right), and their
-- migrations only added grants. This sets exactly what the repository's rule says: read and add, never change,
-- delete or empty (TRUNCATE ignores row security). Row security already refused updates and deletes; this closes the
-- rest. The parking tables already had exactly these rights.
-- Checked as the public role, each in a rolled-back block: a check-in within 500 m is added; one 900 m away is
-- refused by row security; update and truncate are refused; the fullness view reads.
revoke all on public.truck_parking_reports, public.planned_stops from anon, authenticated;
grant select, insert on public.truck_parking_reports, public.planned_stops to anon, authenticated;

revoke all on public.truck_sites, public.truck_site_status from anon, authenticated;
grant select on public.truck_sites, public.truck_site_status to anon, authenticated;

-- Raw downloads: the collector (service role) only.
revoke all on public.raw_snapshots from anon, authenticated;

revoke all on public.truck_fullness_by_hour from anon, authenticated;
grant select on public.truck_fullness_by_hour to anon, authenticated;
