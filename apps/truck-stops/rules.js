// EU driving-time rules (Regulation (EC) 561/2006, as amended by 2020/1054).
// Pure functions, no map or network code, so it can be tested with Node:
//   node apps/truck-stops/rules.test.js
//
// What we model:
//  - Break: 45 min after at most 4 h 30 min of driving. It may be split into
//    15 min + 30 min (in that order); if the 15 min part is already taken,
//    the next break only needs to be 30 min.
//  - Daily driving: max 9 h, or 10 h at most twice per week.
//  - Daily rest: 11 h, or reduced to 9 h at most 3 times between weekly rests.
//  - Weekly driving: max 56 h (we warn; weekly rest planning is not modelled).
// Not modelled yet: the 24 h window for daily rest, split daily rest (3 h + 9 h),
// ferry/train rules, 90 h per two weeks, weekly rests.
(function (root) {
  const LIMITS = {
    maxBeforeBreak: 270, // 4 h 30 min
    breakFull: 45,
    breakSecondPart: 30,
    dayNormal: 9 * 60,
    dayExtended: 10 * 60,
    extendedPerWeek: 2,
    restRegular: 11 * 60,
    restReduced: 9 * 60,
    reducedBetweenWeekly: 3,
    week: 56 * 60,
  };

  // Driver state at the start of the trip. All times in minutes.
  function initialState(s = {}) {
    return {
      sinceBreak: clamp(s.sinceBreak ?? 0, 0, LIMITS.maxBeforeBreak),
      firstPartTaken: !!s.firstPartTaken, // already took the 15 min part
      today: clamp(s.today ?? 0, 0, LIMITS.dayExtended),
      week: Math.max(0, s.week ?? 0),
      extendedUsed: clamp(s.extendedUsed ?? 0, 0, LIMITS.extendedPerWeek),
      reducedUsed: clamp(s.reducedUsed ?? 0, 0, LIMITS.reducedBetweenWeekly),
      allowExtended: s.allowExtended ?? true,
      preferReduced: s.preferReduced ?? false,
      todayExtended: false, // is today already counted as a 10 h day?
    };
  }

  // Today's driving limit: 9 h, or 10 h if the driver allows it and has some left.
  function dayLimit(st) {
    if (st.todayExtended) return LIMITS.dayExtended;
    if (st.allowExtended && st.extendedUsed < LIMITS.extendedPerWeek) return LIMITS.dayExtended;
    return LIMITS.dayNormal;
  }

  // How long can the driver keep going, and what stop is needed after that?
  // Returns { maxDrive, kind: "break" | "rest", duration }.
  function nextStop(st) {
    const untilBreak = LIMITS.maxBeforeBreak - st.sinceBreak;
    const untilDay = dayLimit(st) - st.today;
    if (untilDay <= untilBreak) {
      return { maxDrive: Math.max(0, untilDay), kind: "rest", duration: restDuration(st) };
    }
    return { maxDrive: Math.max(0, untilBreak), kind: "break", duration: st.firstPartTaken ? LIMITS.breakSecondPart : LIMITS.breakFull };
  }

  function restDuration(st) {
    return st.preferReduced && st.reducedUsed < LIMITS.reducedBetweenWeekly ? LIMITS.restReduced : LIMITS.restRegular;
  }

  // Drive `min` minutes. Returns the new state (does not change the old one).
  function drive(st, min) {
    const n = { ...st, sinceBreak: st.sinceBreak + min, today: st.today + min, week: st.week + min };
    if (!n.todayExtended && n.today > LIMITS.dayNormal) {
      n.todayExtended = true;
      n.extendedUsed += 1;
    }
    return n;
  }

  // Take a stop. A break of 45 min (or 30 min after an earlier 15) resets the
  // 4.5 h counter. A daily rest resets everything for the day.
  function stop(st, kind, duration) {
    if (kind === "rest") {
      const reduced = duration < LIMITS.restRegular;
      return {
        ...st,
        sinceBreak: 0,
        firstPartTaken: false,
        today: 0,
        todayExtended: false,
        reducedUsed: st.reducedUsed + (reduced ? 1 : 0),
      };
    }
    return { ...st, sinceBreak: 0, firstPartTaken: false };
  }

  // Plan a whole trip with no choice of stop place: always stop at the latest
  // allowed moment. Used for tests and as a first estimate. The app itself
  // picks real places a bit earlier and calls nextStop/drive/stop step by step.
  function planLatest(totalDriveMin, startState) {
    let st = initialState(startState);
    let driven = 0;
    let clock = 0; // minutes since departure, including stops
    const steps = [];
    let guard = 0;
    while (driven < totalDriveMin - 0.01 && guard++ < 100) {
      const ns = nextStop(st);
      const d = Math.min(ns.maxDrive, totalDriveMin - driven);
      st = drive(st, d);
      driven += d;
      clock += d;
      if (driven >= totalDriveMin - 0.01) break;
      steps.push({ kind: ns.kind, atDrive: driven, atClock: clock, duration: ns.duration });
      st = stop(st, ns.kind, ns.duration);
      clock += ns.duration;
    }
    return { steps, totalClock: clock, end: st, weekOver: st.week > LIMITS.week };
  }

  function clamp(v, lo, hi) {
    v = Number(v) || 0;
    return Math.min(hi, Math.max(lo, v));
  }

  const api = { LIMITS, initialState, dayLimit, nextStop, drive, stop, planLatest };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof window !== "undefined" ? window : globalThis);
