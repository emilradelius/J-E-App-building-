# J&E App Building — instructions for Claude Code

This repo holds Jacob's and Emil's app ideas and the apps built from them. `index.html` is the App Tracker, which
shows every idea from `data/ideas.js`. The apps live in `apps/<id>/` (today Truck Stop Map and Park for Free), and
`shared/` has the common styles, map helpers and a vendored copy of Leaflet. Park for Free shares reports,
check-ins and sign photos through the Supabase project "je-apps" (`supabase/`).

## Read first, every session
1. `docs/PROGRESS.md`: where we left off. Continue from "Next step".
2. `README.md`: what is in the repo, how to open it, where the data comes from.
3. `data/ideas.js`: the entry for the idea you are working on (status, features, open questions, log).

## Hard rules
- **No build step, no npm dependencies for the apps.** Plain HTML, CSS and JavaScript that a browser runs as is.
  Leaflet is vendored in `shared/vendor/leaflet/`; don't add a bundler, a framework or a CDN script.
- **Be gentle with the free map services.** OpenStreetMap tiles, Overpass and Nominatim are free and have usage
  limits. Cache, debounce, query only on an explicit action, and never hammer them (no loops, no per-keystroke or
  per-pan queries).
- **The Supabase tables are append-only for the public key.** Anyone may read and add; nobody may edit or delete
  through the app. RLS and grants decide what the anon key can do, so every change to them is a new migration in
  `supabase/migrations/`.
- **Secrets only as Supabase Edge Function secrets**, never in the repo, the HTML or a chat. The anon key in
  `shared/supabase-config.js` is public by design; don't copy its value anywhere else. The service role key never
  reaches the browser.
- **AI only through Anthropic** (today the `read-sign` Edge Function). Load the `claude-api` skill before changing
  a Claude call.
- **Work on a branch and open a pull request.** The owners merge.

## How to run
```bash
python3 -m http.server          # from the repo root, then http://localhost:8000
```
The map apps need internet. For a phone on the same Wi-Fi use `python3 -m http.server --bind 0.0.0.0`; location
only works over HTTPS or on `localhost`. There are no tests, no lint and no CI; the `je-static-app` skill says how
to check a change by hand.

## The tracker
When you work on an idea, update its entry in `data/ideas.js`: the `status`, the features that are now
`done: true`, and a new line at the top of `log` (newest first) saying who did what:
`{ date: "YYYY-MM-DD", who: "Claude", text: "…" }`. The `je-tracker` skill has the exact shape.

## Review before merging
- Before calling a pull request ready, run `/code-review` and fix what it finds (or say why not).
- Also run `/security-review` when the change touches Supabase policies or grants, the storage bucket, the Edge
  Function, or anything that handles photos or locations.
- Say in the pull request which reviews ran and what they found.

## Hermod (the learning kit in `.claude/`)
- At session start Hermod prints a brief: Status and Next step from `docs/PROGRESS.md`, the lessons in
  `.claude/hermod/LESSONS.md`, and an index of the skills in `.claude/skills/`. Load a skill's `SKILL.md` when it
  applies (`je-tracker`, `je-static-app`, `je-supabase`).
- Search past work: `node .claude/hermod/recall.mjs "query"`.
- The checks in `.claude/hermod/checks/` run when a session ends and look at what changed; run them by hand with
  `node .claude/hermod/check.mjs`.
- At the end of a session, `/reflect` proposes lesson, skill or check changes in the pull request. The owners
  decide by merging; nothing is kept before that.
- This repo owns `config.json`, `LESSONS.md`, `checks/` and the `je-*` skills. The hooks, scripts and kit skills
  come from the hermod repo through its sync script; don't edit them here.

## End of every session
1. Update `docs/PROGRESS.md`: Status, Next step, Open questions, Not done, and one line under Recent sessions.
2. Add a log line to the idea you worked on in `data/ideas.js` (newest first).
3. Run `/reflect` ("nothing to save" is a fine result).
4. Commit and push to the working branch.
