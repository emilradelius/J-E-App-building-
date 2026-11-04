# J&E App Building

Jacob & Emil's app ideas, plus the apps we build from them.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **App Tracker**: every idea with its status, progress, open questions and log |
| `data/ideas.js` | The idea list. **Edit this file to update the tracker** |
| `apps/truck-stops/` | **Truck Break Planner** (v1): enter a trip and your tachograph times; it plans a truck-safe route, places every EU break and daily rest at a real truck stop, and shows the chance of a free space. `nearby.html` is the old "truck stops near me" map |
| `apps/car-parking/` | **Car Parking Finder** (v1): car parks and street parking near a destination, chance of a spot for your arrival time, check-ins and photo reports |
| `shared/` | Shared styles, map helpers and a bundled copy of Leaflet (the map library) |

It's all plain HTML and JavaScript. No install and no build step.

## How to open it

**Easiest:** turn on GitHub Pages (repo → Settings → Pages → Deploy from branch → `main` / root).
Then the tracker is at `https://emilradelius.github.io/J-E-App-building-/` and works on your phone too.

**Locally:** run `python3 -m http.server` in this folder and open http://localhost:8000.
(Double-clicking `index.html` also works for the tracker.)

The map apps need internet. They load map data from OpenStreetMap, which is free and needs no API key.

## Updating the tracker

Open `data/ideas.js` and:
- change `status` (`idea` → `exploring` → `building` → `testing` → `live`, or `parked`)
- tick features with `done: true`, which moves the progress bar
- add a line to `log`, newest first, saying who did what

Then commit and push. The Git history shows who changed what and when.
You can also just tell Claude: *"mark route planning as done on the truck app"*.

## Where the map data comes from

- **Places:** [OpenStreetMap](https://www.openstreetmap.org) via the Overpass API. Coverage is good in Sweden and Europe, but it is volunteer-mapped, so some places are missing or have no details.
- **Place search:** Nominatim (OpenStreetMap).
- **Truck routes:** Valhalla truck routing on the free FOSSGIS server (OpenStreetMap data: height, weight, width limits, hazmat). Falls back to a normal car route (with a warning) if it's down. No live traffic.
- **Navigate links:** open Google Maps directions.

These free servers have usage limits. They're fine for testing. A real launch would need a paid provider or our own server.

## Shared data (Supabase)

The Car Parking Finder stores shared reports, check-ins and photos in the Supabase project **je-apps**:
- Tables `parking_reports` and `parking_checkins` (schema in `supabase/migrations/`). Anyone can read and add rows; nobody can edit or delete through the app.
- Storage bucket `report-photos` (public, images up to 2 MB).
- Edge Function `read-sign` (`supabase/functions/read-sign/`) reads road-sign photos with Claude. It needs the secret `ANTHROPIC_API_KEY` (Supabase dashboard → Edge Functions → Secrets).

The Truck Break Planner uses:
- `truck_parking_reports`: drivers say "spaces / a few / full".
- `planned_stops`: anonymous planned stops, so it can show "N drivers plan to stop here then".
- `truck_sites` and `truck_site_status`: official truck parking sites and live occupancy.
- `truck_fullness_by_hour`: a view of how full each place usually is.
- Edge Function `collect-truck-data`: fills `truck_sites` from Autobahn GmbH in Germany (daily), Statens vegvesen NVDB in Norway (daily) and Trafikverket (every 10 min, once the secret `TRAFIKVERKET_API_KEY` is set). pg_cron runs it.
- "📍 Check in where I'm parked": GPS-confirmed reports (within 500 m). They're stored as `verified` once `20261104_truck_checkins.sql` is applied.

All data sources, and the ones waiting for a sign-up, are listed in `docs/research/truck-data-sources.md`.

Tests for the EU driving-time rules: `node apps/truck-stops/rules.test.js`.

The public connection keys are in `shared/supabase-config.js`. They are meant to be public; the database rules decide what they can do.
