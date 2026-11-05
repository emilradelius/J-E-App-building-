---
name: je-supabase
description: Change the je-apps Supabase project safely. Use when touching supabase/migrations/, a table, an RLS policy, the report-photos bucket, the read-sign Edge Function or its secret, shared/supabase-config.js, or apps/car-parking/reports.js.
---

# Change the Supabase backend (project "je-apps")

Park for Free shares reports, check-ins and sign photos through the Supabase project **je-apps**. The browser has
only the public anon key, so the database rules (RLS, grants, storage policies) are the whole security model.

## What exists today
From `supabase/migrations/20261104_parking_reports_and_checkins.sql`:
- `parking_reports`: `id` (uuid), `type` (`sign` | `construction` | `full` | `free`), `lat`, `lon`, `note`
  (≤ 500 chars), `photo_path` (≤ 200), `sign_reading` (jsonb, written only by `read-sign`), `created_at`.
- `parking_checkins`: `id`, `spot` (≤ 40), `found` (boolean), `lat`, `lon`, `created_at`.
- RLS on both. Policies for `anon, authenticated`: select everything; insert with
  `created_at > now() - interval '1 minute'` (and `sign_reading is null` for reports). Grants: `select, insert`
  only. No update or delete, so rows are append-only through the API.
- Storage bucket `report-photos`: public read, 2 MB, `image/jpeg|png|webp`; one policy lets anyone insert into the
  bucket at any path. No update or delete policy.
- The browser side is `apps/car-parking/reports.js`: plain `fetch` to `/rest/v1/`, `/storage/v1/` and
  `/functions/v1/read-sign` with the anon key from `shared/supabase-config.js` (no supabase-js in the browser).

## Keys and secrets
- `shared/supabase-config.js` holds the project URL and the **legacy anon key** (a JWT, needed to call Edge
  Functions). It is public by design. Don't copy its value into docs, tests, logs or commits; read it from that
  file when you need it.
- The **service role key** bypasses RLS. It exists only inside Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`, set by
  Supabase). It never goes into the browser, the repo or a chat.
- Other secrets (today only `ANTHROPIC_API_KEY`) are Edge Function secrets: Supabase dashboard → Edge Functions →
  Secrets, or `supabase secrets set` by an owner. Never in the repo, `.env` files or the HTML.

## Change the schema or a policy
1. Write a **new** file `supabase/migrations/<YYYYMMDD>_<what>.sql`. Never edit a migration that was applied; the
   database does not re-run it. Start with the same header comment ("Applied to Supabase project "je-apps" on …")
   once it is applied.
2. Keep it additive: new tables or nullable columns. A new table gets `enable row level security`, its policies
   and explicit `grant`s in the same file. Without a policy, RLS denies everything; without a grant, PostgREST
   answers "permission denied".
3. Keep the append-only rule: anon may `select` and `insert`, never `update` or `delete`. Put limits in the
   database (`check` constraints on length and range, `with check` on insert), not only in the browser.
4. Don't add columns for names, e-mail, phone numbers, plates or device ids. Photos and locations are already
   sensitive: anything that links them to a person needs the owners' decision first.
5. Apply it: an owner runs it in the SQL editor, or Claude runs it through the Supabase connector when the owners
   ask. Nothing applies migrations automatically (there is no `supabase/config.toml` and no CI).
6. Check it: run the security advisors (connector `get_advisors`, or Dashboard → Advisors), and with the anon key
   try a select (works), an insert (works), an update and a delete (both must fail).
7. Update `reports.js` and the `README.md` § "Shared data (Supabase)" list if the browser uses something new.

## The `read-sign` Edge Function (`supabase/functions/read-sign/index.ts`)
- Input `{"report_id": "<uuid>"}` (POST). It loads the report with the service role client, returns the stored
  `sign_reading` if there is one (each report is read once), accepts only `type = 'sign'` with a photo, sends the
  public photo URL to Claude and writes `sign_reading`.
- Model call: `@anthropic-ai/sdk` (pinned `npm:` import), `beta.messages.parse` with `model: "claude-opus-5-5"`,
  `max_tokens: 16000`, `output_config` (`effort: "medium"`, zod format `SignReading`) and the server-side fallback
  beta. A refusal or unparsed output returns 422; SDK errors map to 429/503/502.
- `SignReading` is a contract with the browser: `Rules.fromSign()` in `apps/car-parking/rules.js` reads `rules[]`
  (`hours`/`when`, `parking_allowed`, `fee`, `max_stay_minutes`, `requires`), `street_cleaning`,
  `street_cleaning_hours` and `confidence`, and `app.js` shows `summary_en`. Rename a field in both places, and
  remember that rows already stored keep the old shape.
- AI goes only to Anthropic. Before changing the Claude call, load the `claude-api` skill (or the kit's
  `anthropic-sdk` skill) and follow it. Keep every `npm:` and `jsr:` import pinned to an exact version.
- Deploy: through the Supabase connector (`deploy_edge_function`) or `supabase functions deploy read-sign` by an
  owner. The repo does not record the deployed version or settings such as `verify_jwt`; read them with the
  connector (`get_edge_function`) before assuming the repo matches.
- Cost: anyone with the anon key can add sign reports and call the function, and there is no rate limit. Every new
  sign photo costs one Claude call.

## Review
Run `/security-review` on any change to a policy, grant, the bucket, the Edge Function, or code that handles photos
or locations, and say in the pull request what it found.
