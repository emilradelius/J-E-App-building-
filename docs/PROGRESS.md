# Progress log

How this file works: it is short on purpose, so a new session can read it whole. Hermod prints "Status" and
"Next step" in the brief at the start of every session. At the end of a session, update Status, Next step, Open
questions and Not done, and add one line under Recent sessions; older detail lives in git history.

## Status (2026-11-09)
- **App Tracker** (`index.html` + `data/ideas.js`): live. Seven ideas; two are being built (Truck Stop Map, Park
  for Free), one is this tracker.
- **Truck Stop Map v0** (`apps/truck-stops/`): truck stops, rest areas, truck parking and truck fuel from
  OpenStreetMap, place search, "use my location", and a break timer with a range circle (EU 4.5 h rule). No
  routing yet.
- **Park for Free v2** (`apps/car-parking/`): "Can I park here?", free / free until / paid / not allowed for the
  arrival time and stay (OSM tags, sign photos, Swedish holidays), chance of a space per place and per area, best
  time to arrive. Shared reports, check-ins and sign photos in the Supabase project "je-apps"
  (`parking_reports`, `parking_checkins`, bucket `report-photos`), and the `read-sign` Edge Function that reads
  sign photos with Claude (it needs the secret `ANTHROPIC_API_KEY`).
- No tests, no lint, no CI. Checks are by hand in a browser.
- Hermod Part A is installed (#7, merged 2026-11-09): `CLAUDE.md`, this file, `.claude/hermod/config.json`, the
  lessons, two checks (`ideas-js-valid`, `app-files-exist`) and three skills (`je-tracker`, `je-static-app`,
  `je-supabase`). The kit itself (the SessionStart, Stop and PostToolUse hooks, its scripts, and the skills
  `reflect`, `curate`, `anthropic-sdk` and `supabase-rls`) is synced from hermod (kit 0.3.1; the stamp
  names the commit, now `ca5d679`); `.claude/hermod/VERSION.json` lists every kit file with its hash. The kit runs on
  Node 22, only for Claude Code: the apps themselves still have no build step and no dependencies.

## Next step
- The kit is at hermod 0.3.1 (`ca5d679`). This repository is public, so Hermod's state stays on each device here:
  it never opts in to committing session summaries or a graph. A later kit update comes the same way: `node scripts/sync.mjs --target <this repo> --ref <tag or full sha>` from a hermod checkout, in its own
  pull request.
- App work continues from the `nextSteps` in `data/ideas.js`: test Park for Free v2 on real streets, add the
  Claude API key as an Edge Function secret so sign photos get read, and pick a truck-routing provider.

## Open questions
1. The insert policies only check `created_at > now() - interval '1 minute'`, so a client can send a `created_at`
   in the future. Such a "Full right now" report would stay visible far past its one hour. Suggestion: a new
   migration that also caps it (`created_at < now() + interval '1 minute'`), with `/security-review`. Not changed
   here.
2. Anyone with the public key can add sign photos and call `read-sign`, and nothing limits the rate, so each photo
   costs one Claude call. Is that OK while the app is only for testing, or do we want a daily cap?
3. The `truck-stops` entry in `data/ideas.js` has a log line and two next steps about Park for Free v2. They look
   like they belong on `car-parking`. Move them?
4. Is GitHub Pages turned on? Location features need HTTPS, so phone tests of "Can I park here?" depend on it.

## Not done / not verified
- This pull request changes no app code (only `CLAUDE.md`, `docs/` and `.claude/`). The apps were not opened in a
  browser, and `data/ideas.js` was not changed.
- Supabase was not queried. The tables, policies and bucket described in the lessons and the `je-supabase` skill
  come from `supabase/migrations/` and the code; whether the live project matches, whether the deployed
  `read-sign` matches the repo (and its `verify_jwt` setting), and whether `ANTHROPIC_API_KEY` is set were not
  checked.
- After the sync: `node .claude/hermod/validate.mjs` passes (config, lessons, all seven skills), `node
  .claude/hermod/check.mjs --self-test` passes (every example of the two checks gives the expected result), and
  `node .claude/hermod/brief.mjs` prints the brief (about 5,900 of 8,000 characters). The hooks were not tried in a
  live Claude Code session here.
- `ritual.remind` takes plain text in the kit's config schema, so the reminder about `data/ideas.js` is one text
  line, not a `{ path, why }` pair.

## Recent sessions
- 2026-11-11: the Hermod kit synced to 0.3.1 (`ca5d679`), with the seeded checks `hermod-state` and
  `graphify-private`; this public repository keeps its state local. No app code changed.
- 2026-11-09: #7 merged; the kit pinned to hermod's released 0.1.0 (`32589df`); no app code changed.
- 2026-11-06: the Hermod kit synced from hermod (now at `2e8a99a`: hooks, scripts, `reflect`, `curate`,
  `anthropic-sdk`, `supabase-rls`); `/code-review` fixes to both checks (`/security-review` found nothing; both
  results are in the pull request); validator and check self-test pass; no app code changed.
- 2026-11-05: Hermod Part A installed (CLAUDE.md, this progress log, lessons, three skills, two checks); no app
  code changed.
