---
name: je-tracker
description: Add or update an idea in the tracker correctly. Use when adding an idea, changing a status, ticking a feature, adding open questions or next steps, or writing the end-of-session log line in data/ideas.js.
---

# Update the tracker (`data/ideas.js`)

`data/ideas.js` is the single source of truth for the tracker page. `index.html` loads it with
`<script src="data/ideas.js">` and renders everything in the browser from `window.IDEAS`. There is no backend and
no build step: the commit is the update, and the Git history shows who changed what.

## The entry shape
Copy this shape exactly. Every key is read by `index.html`; keep the order the other entries use.
```js
{
  id: "kebab-case-id",            // unique, never reused; apps use the same id as their folder (apps/<id>/)
  name: "Human name",
  status: "idea",                 // idea | exploring | building | testing | live | parked
  priority: 2,                    // 1 (highest) .. 3
  owner: "",                      // free text, "" when nobody owns it yet
  app: "",                        // link to open the app, e.g. "apps/<id>/"; "" when there is none
  summary: "One or two sentences: what it is and for whom.",
  features: [
    { text: "Something a person can do", done: false },
  ],
  openQuestions: ["A question we cannot answer yet"],
  nextSteps: ["The next concrete step"],
  log: [
    { date: "YYYY-MM-DD", who: "Claude", text: "What was done, in one line." },
  ],
},
```
- `features`, `openQuestions`, `nextSteps` and `log` are always arrays (empty `[]` is fine). `features[].done` is a
  real boolean (`true`/`false`, not `"yes"`).
- Strings are plain text: `index.html` escapes them, so HTML tags show up literally.
- The file must stay a plain script that assigns `window.IDEAS = [ ... ];`. No `import`, `export` or `require`:
  the page loads it as a classic script, and a syntax error silently leaves the tracker empty.

## How the page uses it (`index.html`)
- **Status:** `STAGES` lists the six statuses with their colours. An unknown status is drawn as "Idea" but counted
  in no pipeline stage, so use only the six values. `idea` → `exploring` → `building` → `testing` → `live`, or
  `parked` at any point.
- **Progress bar:** done features / all features. Ticking a feature (`done: true`) is how progress moves; don't
  delete a feature to make the bar look better.
- **"Updated":** `log[0].date`. That is why the log is **newest first**: a new line goes at the top of `log`.
- **Default sort:** parked last, then priority, then later stages first. Search matches the whole entry as JSON.

## The log line
- One line per session per idea worked on: `{ date: "YYYY-MM-DD", who: "...", text: "..." }`, inserted at the
  top. Use today's date in `YYYY-MM-DD`.
- `who` says who did it. The values in use are `"Claude"`, `"Emil"`, `"Jacob"` and `"Emil & Jacob"`; Claude's own
  work is `"Claude"`. Feedback or a decision from an owner is its own line with their name.
- `text` says what was done or decided, in plain words, with the app version if there is one ("v2: …"). Point to
  a file for detail (`docs/research/…`) rather than pasting it.
- Put the line on the idea it belongs to. Park for Free work goes on `car-parking`, not on `truck-stops`.

## Steps
1. Read the whole entry you will change, and `README.md` § "Updating the tracker".
2. Edit only what changed: status, features ticked or added, questions answered (remove them, or move the answer
   into the log), next steps, and the new log line at the top.
3. A new idea: add a new object with a new unique `id`, `status: "idea"` and a log line saying who raised it.
4. Check: `node .claude/hermod/check.mjs` runs the `ideas-js-valid` check (shape, statuses, dates). Then open the
   page (`python3 -m http.server`, http://localhost:8000) and see the card, its progress and its "updated" date.
5. Commit together with the code change it describes.
