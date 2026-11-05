---
name: je-static-app
description: Build or change a map app as plain HTML and JS. Use when creating apps/<id>/, editing an app's index.html or scripts, changing shared/ (map-utils.js, style.css, vendored Leaflet), adding a map data source, or testing an app on a phone or desktop.
---

# Build a static app

Every app is plain HTML, CSS and JavaScript that a browser runs as is. No npm, no bundler, no framework, no build
step (`README.md`: "No install and no build step"). GitHub Pages or `python3 -m http.server` serves the repo root.

## How an app folder is wired
Look at `apps/truck-stops/` (small) before `apps/car-parking/` (larger).
- `apps/<id>/index.html` holds the markup and any app-only CSS in a `<style>` block, then loads, in this order:
  ```html
  <link rel="stylesheet" href="../../shared/vendor/leaflet/leaflet.css" />
  <link rel="stylesheet" href="../../shared/style.css" />
  ...
  <script src="../../shared/vendor/leaflet/leaflet.js"></script>
  <script src="../../shared/map-utils.js"></script>
  <script src="app.js"></script>
  ```
  Paths are relative (`../../shared/...`), so the app works at any URL prefix (GitHub Pages serves the repo under
  a sub-path). Never use a leading `/`.
- Scripts are classic scripts, not modules. Each shared file assigns one global (`window.MapUtils`,
  `window.SUPABASE`, and in Park for Free `window.Schedule`, `Rules`, `ParkingModel`, `Reports`) and later files
  read it, so a file must come after everything it uses (`schedule.js` → `rules.js` → `model.js` → `reports.js` →
  `app.js`). `app.js` starts by destructuring what it needs: `const { overpass, geocode, ... } = MapUtils;`.
- The panel layout is `.map-app` > `aside.panel` (`.panel-head`, `.list`) + `.map-wrap` > `#map`, styled by
  `shared/style.css`, which also holds the colour tokens for light and dark mode. Link back with
  `<a class="back" href="../../">← All apps</a>`.
- Add the app to `data/ideas.js` (`app: "apps/<id>/"`) so the tracker shows an "Open app" button
  (`je-tracker` skill).

## Shared helpers (`shared/map-utils.js`)
`overpass(query)`, `geocode(text)`, `distance(a, b)` (metres), `fmtDist`, `pos(el)` (position of an OSM element),
`bboxString(map)`, `baseMap(el, center, zoom)` (Leaflet map with OSM tiles and attribution), `locate()`,
`esc(s)` (HTML escape) and `dotIcon(color, size)`. Use `esc()` on every value from OSM, Nominatim, Supabase or the
user before it goes into `innerHTML` or a popup.

## Leaflet
Leaflet 1.9.4 is vendored in `shared/vendor/leaflet/` (`leaflet.js`, `leaflet.css`, `images/`, `LICENSE`). It is
not fetched from a CDN and not updated by a tool: to upgrade, replace the whole folder with the release files and
keep `LICENSE`. Don't edit files inside it. The default `L.marker` icon needs `images/`; prefer `dotIcon()`.

## Map data sources and their limits
All free OpenStreetMap services, no API key, with fair-use policies (`README.md` § "Where the map data comes
from"):
- **Overpass API** (places): `overpass()` races three public servers (`OVERPASS_SERVERS`), starting the next one
  2.5 s after the previous, and caches results in `localStorage` for 30 minutes keyed by the query.
- **Nominatim** (place search): `geocode()`, one request per search, cached the same way. Its policy allows at most
  one request per second, so never call it per keystroke.
- **Tiles**: `tile.openstreetmap.org` through `baseMap()`; keep the attribution.

Rules that keep us inside the limits:
1. Query only on an explicit action (a button, a search, a map tap), never on `moveend` or every keystroke. Work
   that must follow the map (Park for Free's Supabase reports) is debounced (`scheduleReports()`, 400 ms).
2. Ask for a bounded area: the truck map refuses below zoom 9 (`MIN_ZOOM_FOR_SEARCH`); Park for Free queries a
   box of radius + 150 m around the destination. Always put `[timeout:N]` and an `out ... <limit>` in the query.
3. Keep the query text stable for the same request, so the cache hits.
4. Drop answers from an older request (Park for Free's `loadId` pattern) instead of starting more requests.
5. Show the busy message `overpass()` throws; don't retry in a loop.
6. A real launch needs a paid provider or our own server (`README.md`); say so instead of adding more free servers.

## Test it
1. From the repo root: `python3 -m http.server` and open http://localhost:8000/apps/<id>/. The map needs internet.
2. Desktop: open the browser console; there must be no errors. Try search, a map tap and the main buttons.
3. Phone on the same Wi-Fi: `python3 -m http.server --bind 0.0.0.0` and open `http://<computer's LAN IP>:8000`.
   Location (`navigator.geolocation`) only works in a secure context (HTTPS or `localhost`), so "Use my location"
   and "Can I park here?" fail on a LAN address; test those over HTTPS (GitHub Pages, if it is turned on) after
   merge, or say they were not tested. The photo picker is a plain file input and works on either.
4. Check narrow screens (the `@media (max-width: 760px)` rules) and dark mode.
5. Write down what you tested and what you could not (no browser in an agent session means "not verified").
