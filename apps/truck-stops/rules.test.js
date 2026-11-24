// Tests for the EU driving-time rules. Run: node apps/truck-stops/rules.test.js
const assert = require("assert");
const R = require("./rules.js");

const t = (name, fn) => {
  try { fn(); console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e.message); process.exitCode = 1; }
};
const kinds = (p) => p.steps.map((s) => `${s.kind}@${s.atDrive}`).join(" ");

t("short trip needs no stop", () => {
  const p = R.planLatest(200, {});
  assert.strictEqual(p.steps.length, 0);
  assert.strictEqual(p.totalClock, 200);
});

t("exactly 4.5 h needs no stop", () => {
  assert.strictEqual(R.planLatest(270, {}).steps.length, 0);
});

t("6 h trip: one 45 min break at 4.5 h", () => {
  const p = R.planLatest(360, {});
  assert.strictEqual(kinds(p), "break@270");
  assert.strictEqual(p.steps[0].duration, 45);
  assert.strictEqual(p.totalClock, 405);
});

t("already driven 3 h: break after 1.5 h more", () => {
  const p = R.planLatest(240, { sinceBreak: 180, today: 180 });
  assert.strictEqual(kinds(p), "break@90");
});

t("15 min part already taken: next break is 30 min", () => {
  const p = R.planLatest(300, { firstPartTaken: true });
  assert.strictEqual(p.steps[0].duration, 30);
});

t("9 h day without extension: break, then daily rest at 9 h", () => {
  const p = R.planLatest(700, { allowExtended: false });
  assert.strictEqual(kinds(p), "break@270 rest@540");
  assert.strictEqual(p.steps[1].duration, 660);
});

t("10 h day allowed: 2 breaks, rest at 10 h", () => {
  const p = R.planLatest(700, {});
  assert.strictEqual(kinds(p), "break@270 break@540 rest@600");
  assert.strictEqual(p.end.extendedUsed, 1);
});

t("no 10 h days left: rest at 9 h", () => {
  const p = R.planLatest(700, { extendedUsed: 2 });
  assert.strictEqual(kinds(p), "break@270 rest@540");
});

t("two-day trip: second day can also be 10 h, third falls back to 9 h", () => {
  const p = R.planLatest(30 * 60, {});
  // Day 1: 10 h, day 2: 10 h, day 3: 9 h limit (no extensions left), 10 h remain → rest at 9 h again
  const rests = p.steps.filter((s) => s.kind === "rest").map((s) => s.atDrive);
  assert.deepStrictEqual(rests, [600, 1200, 1740]);
});

t("reduced 9 h rest used when preferred, max 3 times", () => {
  const p = R.planLatest(50 * 60, { preferReduced: true, allowExtended: false });
  const rests = p.steps.filter((s) => s.kind === "rest").map((s) => s.duration);
  assert.deepStrictEqual(rests.slice(0, 4), [540, 540, 540, 660]);
});

t("day already at limit: immediate daily rest", () => {
  const ns = R.nextStop(R.initialState({ today: 540, allowExtended: false }));
  assert.strictEqual(ns.kind, "rest");
  assert.strictEqual(ns.maxDrive, 0);
});

t("week over 56 h is flagged", () => {
  assert.strictEqual(R.planLatest(120, { week: 55 * 60 }).weekOver, true);
  assert.strictEqual(R.planLatest(30, { week: 55 * 60 }).weekOver, false);
});

t("stopping early resets the break counter from that point", () => {
  let st = R.initialState({});
  st = R.drive(st, 200);
  st = R.stop(st, "break", 45);
  const ns = R.nextStop(st);
  assert.strictEqual(ns.kind, "break");
  assert.strictEqual(ns.maxDrive, 270);
});
