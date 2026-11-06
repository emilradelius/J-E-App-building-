# Lessons
<!-- hermod:lessons — declarative facts, separated by a line containing only §. Cap in config.json
     (lessons.capChars). Changes go through a pull request. -->

data/ideas.js is a plain script that sets window.IDEAS; index.html loads it with a script tag and reads (window.IDEAS || []). A syntax error there leaves the tracker empty ("No ideas match.") with no error on the page.
§
Tracker statuses are idea, exploring, building, testing, live and parked (STAGES in index.html). An unknown status shows as Idea but is counted in no stage. Progress is the share of features with done: true; "updated" is log[0].date, so the log is newest first.
§
The apps have no modules and no build: each apps/<id>/index.html loads ../../shared/vendor/leaflet/leaflet.js, then ../../shared/map-utils.js (window.MapUtils), then its own scripts in order. Park for Free's files share globals (Schedule, Rules, ParkingModel, Reports), so script order matters.
§
Leaflet 1.9.4 is vendored in shared/vendor/leaflet/ with its images/ folder. The default L.marker icon (Park for Free's destination pin) needs those images; every other marker is MapUtils.dotIcon or another divIcon.
§
Map data is free OpenStreetMap: Overpass (three public servers, raced with a 2.5 s stagger), Nominatim for place search and tile.openstreetmap.org for tiles. MapUtils caches Overpass and Nominatim answers in localStorage for 30 minutes, keyed by the query text.
§
One Park for Free destination starts up to three Overpass queries (car parks, street parking, area activity), each of which can reach all three servers when the first is slow. Overpass runs only on an explicit action (search, map tap, "Can I park here?", radius change), never on pan.
§
In Supabase project je-apps, parking_reports and parking_checkins have select and insert policies for anon and no update or delete policy. Inserts need created_at > now() - 1 minute (a future created_at still passes); report inserts also need sign_reading null.
§
The report-photos bucket is public, 2 MB, JPEG/PNG/WebP, insert-only for anon at any path. shrinkPhoto() re-encodes photos in the browser through a canvas (max 1200 px JPEG), which drops EXIF; a report's position is the map centre under the crosshair.
§
The read-sign Edge Function reads a report with the service role key that Supabase provides, sends the photo URL to claude-opus-5-5 with a zod output format, and writes sign_reading once. It needs the secret ANTHROPIC_API_KEY; the browser calls it with the legacy anon JWT.
§
The SQL in supabase/migrations/ was applied by hand to je-apps; there is no supabase/config.toml, so the repo records neither function settings such as verify_jwt nor what is deployed. A changed migration file never reaches the database by itself.
§
reports.js hides reports older than their type's keepDays (sign 365 days, construction 30, full and free 1 hour) in the browser; old rows stay in the table. Up to 5000 check-ins from the last 180 days are read per area.
