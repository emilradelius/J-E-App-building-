# Progress log

How this file works: it is short on purpose, so a new session can read it whole. Hermod prints "Status" and
"Next step" in the brief at the start of every session. At the end of a session, update Status, Next step, Open
questions and Not done, and add one line under Recent sessions; older detail lives in git history.

## Status (2026-11-05)
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
- Hermod Part A is installed by this pull request: `CLAUDE.md`, this file, `.claude/hermod/config.json`, the
  lessons, two checks (`ideas-js-valid`, `app-files-exist`) and three skills (`je-tracker`, `je-static-app`,
  `je-supabase`). The kit's hooks, scripts and own skills come from the hermod sync in a later commit.

## Next step
- The owners review and merge this pull request.
- Then the hermod sync adds the kit files (`node scripts/sync.mjs --target <this repo> --ref <tag>` from a hermod
  checkout), in its own pull request.
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
- The kit files (hooks, scripts, kit skills) are not in this commit. Until the sync adds them, the session brief,
  `recall.mjs`, the check runner and `/reflect` do not run here.
- Hermod's validator (`validate.mjs --strict`, from the unreleased kit on the hermod working branch) passed with no
  errors or warnings: config, lessons and all three skills.
- The kit's check runner did not exist yet, so `check.mjs --self-test` was not run. The two checks were run with a
  stand-in harness instead: every example gives the expected result (with both plain and promise-returning reads),
  both checks pass on the current repo, and both fail when a real file is broken or removed.
- `ritual.remind` takes plain text in the kit's config schema, so the reminder about `data/ideas.js` is one text
  line, not a `{ path, why }` pair.

## Recent sessions
- 2026-11-05: Hermod Part A installed (CLAUDE.md, this progress log, lessons, three skills, two checks); no app
  code changed.
