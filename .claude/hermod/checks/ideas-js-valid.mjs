// @ts-check
// Lesson as a check: index.html renders the tracker from window.IDEAS, which data/ideas.js sets. A syntax error
// or a wrong shape there leaves the page empty or wrong without any message, so this check runs the file the way
// the page does and checks the shape the page reads.
//
// The file is evaluated with node:vm in a fresh context that holds only { window: {} } (no require, no process,
// no timers) and a 1 s timeout. node:vm is not a security boundary: it runs the repository's own committed file,
// which is reviewed in a pull request like any other code.
import vm from 'node:vm';

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

/**
 * Runs the file like the page does and returns window.IDEAS, or an error text.
 * @param {string} text
 * @returns {{ ideas?: unknown, error?: string }}
 */
function evaluate(text) {
  const sandbox = { window: /** @type {Record<string, unknown>} */ ({}) };
  try {
    const script = new vm.Script(text.replace(/^﻿/, ''), { filename: FILE });
    script.runInContext(vm.createContext(sandbox), { timeout: 1000 });
  } catch (e) {
    const err = /** @type {Error} */ (e);
    const where = String(err && err.stack ? err.stack : '').split('\n')[0];
    const at = /^data\/ideas\.js:\d+/.test(where) ? ` at ${where}` : '';
    const why = err && err.message ? err.message : String(e);
    if (err && err.name === 'SyntaxError') {
      return { error: `${FILE} is not a plain script${at}: ${why}. The tracker page would show no ideas` };
    }
    return {
      error:
        `${FILE} failed when run${at}: ${why}. It may only assign window.IDEAS = [...]; ` +
        'the check runs it with nothing but window (no timers, no other globals)',
    };
  }
  if (!('IDEAS' in sandbox.window)) return { error: `${FILE} does not set window.IDEAS` };
  return { ideas: sandbox.window.IDEAS };
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
