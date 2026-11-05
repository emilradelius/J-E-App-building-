// @ts-check
// Lesson as a check: the pages are plain HTML that load their scripts and styles by relative path
// (../../shared/map-utils.js, ../../shared/vendor/leaflet/leaflet.js, app.js, ...). A wrong or removed path gives a
// blank or broken page with no build error to warn anyone, so every local <script src> and <link href> of the
// pages must point at a file in the repository, and never outside it.
//
// Pages checked: index.html and apps/*/index.html (listed with git when the runner offers it), plus every changed
// .html file under apps/. External URLs (https:, //, data:) are skipped.
import path from 'node:path';

const PAGE = /^(?:index\.html|apps\/[^/]+\/[^/]*\.html)$/;

/** @param {string} p */
const posix = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

/** @param {unknown} v */
const isThenable = (v) => !!v && typeof (/** @type {{ then?: unknown }} */ (v).then) === 'function';

/**
 * ctx.read may return a string, null/undefined (missing file) or throw.
 * @param {any} ctx
 * @param {string} file
 * @returns {unknown}
 */
function readSafe(ctx, file) {
  try {
    return ctx.read(file);
  } catch {
    return null;
  }
}

/**
 * The pages to check: changed pages, plus the tracked ones when ctx.git can list them synchronously.
 * @param {any} ctx
 * @returns {string[]}
 */
function pages(ctx) {
  const set = new Set();
  for (const f of ctx.changedFiles ?? []) {
    const rel = posix(f);
    if (PAGE.test(rel)) set.add(rel);
  }
  try {
    if (typeof ctx.git === 'function') {
      const out = ctx.git(['ls-files', '--', 'index.html', 'apps/*/index.html']);
      if (typeof out === 'string') {
        for (const line of out.split(/\r?\n/)) {
          const rel = posix(line.trim());
          if (rel && PAGE.test(rel)) set.add(rel);
        }
      }
    }
  } catch {
    // no git in this context: check the changed pages only
  }
  return [...set].sort();
}

/**
 * Local script and stylesheet references in a page, without HTML comments.
 * @param {string} html
 * @returns {string[]}
 */
function references(html) {
  const text = html.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  /** @type {string[]} */
  const refs = [];
  const tag = /<(script|link)\b([^>]*)>/gi;
  for (let m = tag.exec(text); m; m = tag.exec(text)) {
    const attrs = m[2];
    const name = m[1].toLowerCase() === 'script' ? 'src' : 'href';
    if (name === 'href' && !/\brel\s*=\s*["']?[^"'>]*\b(?:stylesheet|icon|manifest|preload|modulepreload)\b/i.test(attrs)) continue;
    const a = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
    if (!a) continue;
    const value = (a[1] ?? a[2] ?? a[3] ?? '').trim();
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) continue;
    refs.push(value);
  }
  return refs;
}

/**
 * The problems found without reading targets, and the targets that must exist.
 * @param {string[]} files
 * @param {unknown[]} texts
 * @returns {{ bad: string[], targets: Array<{ page: string, ref: string, target: string }> }}
 */
function collect(files, texts) {
  /** @type {string[]} */
  const bad = [];
  /** @type {Array<{ page: string, ref: string, target: string }>} */
  const targets = [];
  files.forEach((page, i) => {
    const html = texts[i];
    if (html === null || html === undefined) return; // a deleted page has nothing to load
    for (const ref of references(String(html))) {
      const clean = ref.replace(/[?#].*$/, '');
      if (!clean || clean.endsWith('/')) continue;
      if (clean.startsWith('/')) {
        bad.push(`${page} → ${ref} (a root path breaks under the GitHub Pages sub-path; use a relative path)`);
        continue;
      }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(page), clean));
      if (target === '..' || target.startsWith('../')) {
        bad.push(`${page} → ${ref} (points outside the repository)`);
        continue;
      }
      targets.push({ page, ref, target });
    }
  });
  return { bad, targets };
}

/**
 * @param {string[]} bad
 * @param {Array<{ page: string, ref: string, target: string }>} targets
 * @param {unknown[]} found what ctx.read gave for each target
 */
function verdict(bad, targets, found) {
  const all = [...bad];
  targets.forEach((t, i) => {
    if (found[i] === null || found[i] === undefined) all.push(`${t.page} → ${t.ref} (no file ${t.target})`);
  });
  if (!all.length) return { ok: true };
  const shown = all.slice(0, 6).join('; ') + (all.length > 6 ? `; and ${all.length - 6} more` : '');
  return { ok: false, message: `Pages load files that are not there: ${shown}. See the je-static-app skill.` };
}

/** @param {unknown[]} values */
const settle = (values) => Promise.all(values.map((v) => Promise.resolve(v).catch(() => null)));

/** @type {import('../lib/checks.mjs').Check} */
export default {
  id: 'app-files-exist',
  description: 'Every local script and stylesheet that index.html or an app page loads exists in the repository.',
  level: 'error',
  when: ['apps/', 'shared/', 'index.html', 'data/'],
  run(ctx) {
    const files = pages(ctx);
    const texts = files.map((f) => readSafe(ctx, f));
    /** @param {unknown[]} t */
    const finish = (t) => {
      const { bad, targets } = collect(files, t);
      const found = targets.map((x) => readSafe(ctx, x.target));
      if (found.some(isThenable)) return settle(found).then((f) => verdict(bad, targets, f));
      return verdict(bad, targets, found);
    };
    if (texts.some(isThenable)) return settle(texts).then(finish);
    return finish(texts);
  },
  examples: [
    {
      name: 'passes when an app page loads shared files that exist (Windows line endings)',
      ctx: {
        changedFiles: ['apps/truck-stops/index.html'],
        files: {
          'apps/truck-stops/index.html':
            '<link rel="stylesheet" href="../../shared/vendor/leaflet/leaflet.css" />\r\n' +
            '<a class="back" href="../../">← All apps</a>\r\n' +
            '<script src="../../shared/vendor/leaflet/leaflet.js"></script>\r\n<script src="../../shared/map-utils.js"></script>\r\n' +
            '<script src="app.js"></script>\r\n<script>const x = 1;</script>\r\n',
          'shared/vendor/leaflet/leaflet.css': '',
          'shared/vendor/leaflet/leaflet.js': '',
          'shared/map-utils.js': '',
          'apps/truck-stops/app.js': '',
        },
        baseFiles: {},
      },
      expect: true,
    },
    {
      name: 'passes for external URLs, links to folders and references inside comments',
      ctx: {
        changedFiles: ['index.html'],
        files: {
          'index.html':
            '<link rel="stylesheet" href="https://fonts.example.org/x.css">\n<script src="data/ideas.js?v=2"></script>\n' +
            '<!-- <script src="old.js"></script> -->\n<a href="apps/car-parking/">Open</a>\n',
          'data/ideas.js': 'window.IDEAS = [];',
        },
        baseFiles: {},
      },
      expect: true,
    },
    {
      name: 'fails when a shared script the page loads is missing',
      ctx: {
        changedFiles: ['apps/car-parking/index.html'],
        files: {
          'apps/car-parking/index.html': '<script src="../../shared/map-utils.js"></script>\n<script src="../../shared/supabase-config.js"></script>\n',
          'shared/map-utils.js': '',
        },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails on a root path or a path that leaves the repository',
      ctx: {
        changedFiles: ['apps/new-app/index.html'],
        files: {
          'apps/new-app/index.html': "<link rel='stylesheet' href='/shared/style.css'>\n<script src='../../../outside.js'></script>\n",
          'shared/style.css': '',
        },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails when the app’s own script is missing',
      ctx: {
        changedFiles: ['apps/truck-stops/index.html'],
        files: { 'apps/truck-stops/index.html': '<script src=app.js></script>\n' },
        baseFiles: {},
      },
      expect: false,
    },
  ],
};
