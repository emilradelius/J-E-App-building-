# J&E App Building

Jacob & Emil's app ideas, plus the apps we build from them.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **App Tracker**: every idea with its status, progress, open questions and log |
| `data/ideas.js` | The idea list. **Edit this file to update the tracker** |
| `apps/truck-stops/` | **Truck Stop Map** (v0): truck stops, rest areas, truck parking and fuel on a map, plus a break timer (EU 4.5 h rule) |
| `apps/car-parking/` | **Park for Free** (v2, was Car Parking Finder): “Can I park here for free?”, free/paid rules for your arrival time and stay, chance of a space, best time to arrive, check-ins and sign photos |
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
- **Navigate links:** open Google Maps directions.

These free servers have usage limits. They're fine for testing. A real launch would need a paid provider or our own server.

## Shared data (Supabase)

The Car Parking Finder stores shared reports, check-ins and photos in the Supabase project **je-apps**:
- Tables `parking_reports` and `parking_checkins` (schema in `supabase/migrations/`). Anyone can read and add rows; nobody can edit or delete through the app.
- Storage bucket `report-photos` (public, images up to 2 MB).
- Edge Function `read-sign` (`supabase/functions/read-sign/`) reads road-sign photos with Claude. It needs the secret `ANTHROPIC_API_KEY` (Supabase dashboard → Edge Functions → Secrets).

The public connection keys are in `shared/supabase-config.js`. They are meant to be public; the database rules decide what they can do.
