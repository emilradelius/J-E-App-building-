# J&E App Building

Jacob & Emil's app ideas, plus the apps we build from them.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **App Tracker**: every idea with its status, progress, open questions and log |
| `data/ideas.js` | The idea list. **Edit this file to update the tracker** |
| `apps/truck-stops/` | **Truck Stop Map** (v0): truck stops, rest areas, truck parking and fuel on a map, plus a break timer (EU 4.5 h rule) |
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
- **Navigate links:** open Google Maps directions.

These free servers have usage limits. They're fine for testing. A real launch would need a paid provider or our own server.
