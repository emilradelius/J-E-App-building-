// @ts-check
// Lesson as a check: index.html renders the tracker from window.IDEAS, which data/ideas.js sets. A syntax error
// or a wrong shape there leaves the page empty or wrong without any message, so this check reads the file and
// checks the shape the page reads.
//
// The file is never run. It is parsed as data: comments and `window.IDEAS = [ ... ];` holding only text in
// quotes, numbers, true/false/null, lists and objects. Anything else (a call, a variable, a template string, an
// expression) is reported as "not a plain data file". Running it, even in node:vm, would let a pull request run
// code on the reviewer's machine when a session ends.

const FILE = 'data/ideas.js';
const STATUSES = ['idea', 'exploring', 'building', 'testing', 'live', 'parked'];
const MAX_SHOWN = 8;

/** @param {unknown} v */
const isThenable = (v) => !!v && typeof (/** @type {{ then?: unknown }} */ (v).then) === 'function';

/** @param {unknown} v */
const isText = (v) => typeof v === 'string' && v.trim() !== '';

/** @param {unknown} v */
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} v */
const shown = (v) => {
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 40 ? s.slice(0, 40) + '…' : s;
  } catch {
    return String(v);
  }
};

/**
 * True for a real calendar date written as YYYY-MM-DD.
 * @param {unknown} v
 */
function isDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const MAX_BYTES = 2_000_000;
const MAX_DEPTH = 20;

/**
 * Parses `window.IDEAS = <literal>;` (with comments) without running anything.
 * @param {string} src
 * @returns {unknown}
 */
function parseData(src) {
  let i = 0;
  /** @param {string} why */
  const fail = (why) => {
    const line = src.slice(0, i).split('\n').length;
    throw new SyntaxError(`${why} at line ${line}`);
  };
  const skip = () => {
    for (;;) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i += 1;
      else if (c === '/' && src[i + 1] === '/') {
        const end = src.indexOf('\n', i);
        i = end < 0 ? src.length : end;
      } else if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) fail('a comment is not closed');
        i = end + 2;
      } else return;
    }
  };
  /** @param {string} word */
  const expect = (word) => {
    skip();
    if (!src.startsWith(word, i)) fail(`expected "${word}"`);
    i += word.length;
  };
  /** @returns {string} */
  const string = () => {
    const quote = src[i];
    i += 1;
    let out = '';
    for (;;) {
      const c = src[i];
      if (c === undefined || c === '\n') fail('a text in quotes is not closed');
      if (c === quote) {
        i += 1;
        return out;
      }
      if (c === '\\') {
        const e = src[i + 1];
        const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', "'": "'", '\\': '\\', '/': '/' };
        if (e !== undefined && Object.hasOwn(simple, e)) {
          out += simple[/** @type {keyof typeof simple} */ (e)];
          i += 2;
        } else if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) {
          out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
          i += 6;
        } else fail('an unknown escape in a text');
      } else {
        out += c;
        i += 1;
      }
    }
  };
  /** @param {number} depth @returns {unknown} */
  const value = (depth) => {
    if (depth > MAX_DEPTH) fail('the data is nested too deeply');
    skip();
    const c = src[i];
    if (c === '"' || c === "'") return string();
    if (c === '[') {
      i += 1;
      /** @type {unknown[]} */
      const list = [];
      for (;;) {
        skip();
        if (src[i] === ']') {
          i += 1;
          return list;
        }
        list.push(value(depth + 1));
        skip();
        if (src[i] === ',') i += 1;
        else if (src[i] !== ']') fail('expected "," or "]"');
      }
    }
    if (c === '{') {
      i += 1;
      /** @type {Record<string, unknown>} */
      const obj = {};
      for (;;) {
        skip();
        if (src[i] === '}') {
          i += 1;
          return obj;
        }
        let key;
        if (src[i] === '"' || src[i] === "'") key = string();
        else {
          const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 200));
          if (!m) fail('expected a property name');
          key = /** @type {RegExpExecArray} */ (m)[0];
          i += key.length;
        }
        expect(':');
        // An own property even for "__proto__", so a key can never change the object's prototype.
        Object.defineProperty(obj, key, { value: value(depth + 1), enumerable: true, writable: true, configurable: true });
        skip();
        if (src[i] === ',') i += 1;
        else if (src[i] !== '}') fail('expected "," or "}"');
      }
    }
    const num = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i, i + 40));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    for (const [word, v] of /** @type {Array<[string, unknown]>} */ ([['true', true], ['false', false], ['null', null]])) {
      if (src.startsWith(word, i) && !/[\w$]/.test(src[i + word.length] ?? '')) {
        i += word.length;
        return v;
      }
    }
    return fail('only text in quotes, numbers, true/false/null, lists and objects are allowed');
  };
  expect('window');
  expect('.');
  expect('IDEAS');
  expect('=');
  const ideas = value(0);
  skip();
  if (src[i] === ';') i += 1;
  skip();
  if (i < src.length) fail('unexpected text after window.IDEAS = [...]');
  return ideas;
}

/**
 * Reads window.IDEAS from the file without running it, or returns an error text.
 * @param {string} text
 * @returns {{ ideas?: unknown, error?: string }}
 */
function evaluate(text) {
  if (text.length > MAX_BYTES) return { error: `${FILE} is larger than ${MAX_BYTES} characters` };
  try {
    return { ideas: parseData(text.replace(/^\uFEFF/, '')) };
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return {
      error:
        `${FILE} is not a plain data file (${why}). It may hold only comments and window.IDEAS = [ ... ]; with ` +
        'text in quotes, numbers, true/false/null, lists and objects. The tracker page would show no ideas',
    };
  }
}

/**
 * Every shape problem in the list, as exact texts.
 * @param {unknown} ideas
 * @returns {string[]}
 */
function problems(ideas) {
  if (!Array.isArray(ideas)) return [`window.IDEAS must be an array (got ${shown(ideas)})`];
  /** @type {string[]} */
  const out = [];
  /** @type {Map<string, number>} */
  const seen = new Map();
  ideas.forEach((idea, i) => {
    if (!isObject(idea)) {
      out.push(`IDEAS[${i}] must be an object (got ${shown(idea)})`);
      return;
    }
    const it = /** @type {Record<string, unknown>} */ (idea);
    const label = `IDEAS[${i}]${isText(it.id) ? ` (${it.id})` : ''}`;
    if (!isText(it.id)) out.push(`${label}: id must be non-empty text (got ${shown(it.id)})`);
    else if (seen.has(/** @type {string} */ (it.id))) {
      out.push(`${label}: id "${it.id}" is already used by IDEAS[${seen.get(/** @type {string} */ (it.id))}]`);
    } else seen.set(/** @type {string} */ (it.id), i);
    if (!isText(it.name)) out.push(`${label}: name must be non-empty text (got ${shown(it.name)})`);
    if (!STATUSES.includes(/** @type {string} */ (it.status))) {
      out.push(`${label}: status ${shown(it.status)} is not one of ${STATUSES.join(', ')}`);
    }
    if (it.priority !== undefined && ![1, 2, 3].includes(/** @type {number} */ (it.priority))) {
      out.push(`${label}: priority must be 1, 2 or 3 (got ${shown(it.priority)})`);
    }
    for (const key of ['openQuestions', 'nextSteps']) {
      const list = it[key];
      if (list === undefined) continue;
      if (!Array.isArray(list)) out.push(`${label}: ${key} must be an array (got ${shown(list)})`);
      else list.forEach((q, j) => { if (!isText(q)) out.push(`${label}: ${key}[${j}] must be non-empty text`); });
    }
    if (!Array.isArray(it.features)) out.push(`${label}: features must be an array (got ${shown(it.features)})`);
    else {
      it.features.forEach((f, j) => {
        if (!isObject(f)) return void out.push(`${label}: features[${j}] must be { text, done }`);
        if (!isText(f.text)) out.push(`${label}: features[${j}].text must be non-empty text`);
        if (typeof f.done !== 'boolean') out.push(`${label}: features[${j}].done must be true or false (got ${shown(f.done)})`);
      });
    }
    if (!Array.isArray(it.log)) out.push(`${label}: log must be an array (got ${shown(it.log)})`);
    else {
      /** @type {string | null} */
      let previous = null;
      it.log.forEach((l, j) => {
        if (!isObject(l)) return void out.push(`${label}: log[${j}] must be { date, who, text }`);
        if (!isDay(l.date)) out.push(`${label}: log[${j}].date must be a date as YYYY-MM-DD (got ${shown(l.date)})`);
        else {
          if (previous !== null && l.date > previous) {
            out.push(`${label}: log[${j}] (${l.date}) is newer than log[${j - 1}] (${previous}); the log is newest first`);
          }
          previous = /** @type {string} */ (l.date);
        }
        if (!isText(l.who)) out.push(`${label}: log[${j}].who must be non-empty text (got ${shown(l.who)})`);
        if (!isText(l.text)) out.push(`${label}: log[${j}].text must be non-empty text`);
      });
    }
  });
  return out;
}

/** @param {unknown} text */
function verdict(text) {
  if (text === null || text === undefined) {
    return { ok: false, message: `${FILE} is missing; index.html loads it to show the tracker.` };
  }
  const { ideas, error } = evaluate(String(text));
  if (error) return { ok: false, message: `${error} (see the je-tracker skill).` };
  const found = problems(ideas);
  if (!found.length) return { ok: true };
  const list = found.slice(0, MAX_SHOWN).join('; ') + (found.length > MAX_SHOWN ? `; and ${found.length - MAX_SHOWN} more` : '');
  return { ok: false, message: `${FILE}: ${list}. See the je-tracker skill for the entry shape.` };
}

/** @type {import('../lib/checks.mjs').Check} */
export default {
  id: 'ideas-js-valid',
  description: 'data/ideas.js runs as a plain script and window.IDEAS has the shape the tracker page reads.',
  level: 'error',
  when: ['data/ideas.js'],
  run(ctx) {
    /** @type {unknown} */
    let text;
    try {
      text = ctx.read(FILE);
    } catch {
      text = null;
    }
    if (isThenable(text)) {
      return Promise.resolve(text).catch(() => null).then(verdict);
    }
    return verdict(text);
  },
  examples: [
    {
      name: 'fails, without running it, on code that reaches outside the data',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': "window.IDEAS = window.constructor.constructor('return process')().exit(1);\n" },
      },
      expect: false,
    },
    {
      name: 'passes for a valid list with Windows line endings',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: {
          'data/ideas.js':
            '// tracker\r\nwindow.IDEAS = [\r\n  {\r\n    id: "truck-stops", name: "Truck Stop Map", status: "building", priority: 1,\r\n' +
            '    features: [{ text: "Map", done: true }, { text: "Route", done: false }],\r\n' +
            '    openQuestions: ["Which API?"], nextSteps: [],\r\n' +
            '    log: [{ date: "2026-11-04", who: "Claude", text: "Built v1." }, { date: "2026-11-03", who: "Emil & Jacob", text: "Idea." }],\r\n' +
            '  },\r\n  { id: "collab-tool", name: "Collab", status: "parked", features: [], log: [] },\r\n];\r\n',
        },
        baseFiles: {},
      },
      expect: true,
    },
    {
      name: 'fails on a syntax error',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': 'window.IDEAS = [\n  { id: "a", name: "A", status: "idea", features: [], log: [] }\n  { id: "b" },\n];\n' },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails when the file is an ES module',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': 'export const IDEAS = [];\n' },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails when window.IDEAS is not set or not an array',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': 'window.IDEAS = { "truck-stops": {} };\n' },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails on a duplicate id and an unknown status',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: {
          'data/ideas.js':
            'window.IDEAS = [\n  { id: "a", name: "A", status: "idea", features: [], log: [] },\n' +
            '  { id: "a", name: "B", status: "done", features: [], log: [] },\n];\n',
        },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails when a feature has done: "yes"',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': 'window.IDEAS = [{ id: "a", name: "A", status: "idea", features: [{ text: "x", done: "yes" }], log: [] }];\n' },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails on a log date that is not YYYY-MM-DD, or a missing who',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': 'window.IDEAS = [{ id: "a", name: "A", status: "idea", features: [], log: [{ date: "2026-11-5", text: "x" }] }];\n' },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails when the log is not newest first',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: {
          'data/ideas.js':
            'window.IDEAS = [{ id: "a", name: "A", status: "idea", features: [], log: [\n' +
            '  { date: "2026-11-03", who: "Claude", text: "old" },\n  { date: "2026-11-05", who: "Claude", text: "new" },\n] }];\n',
        },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails, instead of hanging, on an endless loop',
      ctx: { changedFiles: ['data/ideas.js'], files: { 'data/ideas.js': 'while (true) {}\n' }, baseFiles: {} },
      expect: false,
    },
    {
      name: 'fails when the script reaches for timers or require',
      ctx: {
        changedFiles: ['data/ideas.js'],
        files: { 'data/ideas.js': 'setTimeout(() => {}, 10);\nwindow.IDEAS = [];\n' },
        baseFiles: {},
      },
      expect: false,
    },
    {
      name: 'fails when data/ideas.js was deleted',
      ctx: { changedFiles: ['data/ideas.js'], files: {}, baseFiles: { 'data/ideas.js': 'window.IDEAS = [];\n' } },
      expect: false,
    },
  ],
};
