// "Can I park here for free, and for how long?"
//
// Each spot gets a set of rules from the best source we have:
//   1. A road-sign photo near it, read by AI (freshest, most exact)
//   2. OpenStreetMap tags (fee, fee:conditional, maxstay, parking:both:… etc.)
//   3. Nothing → "not sure", with a nudge to photograph the sign
// Then we walk through the user's stay in 15-minute steps and check each rule.
window.Rules = (() => {
  const S = window.Schedule;
  const WEEKDAYS = [1, 2, 3, 4, 5];
  const STEP = 15; // minutes

  const fmtMin = (m) => (m >= 60 ? (m % 60 ? (m / 60).toFixed(1).replace(".0", "") : m / 60) + " h" : m + " min");
  const fmtTime = (d, from) => {
    const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const sameDay = from && d.toDateString() === from.toDateString();
    return sameDay || !from ? t : d.toLocaleDateString([], { weekday: "short" }) + " " + t;
  };

  const feeValue = (v) => (v === "no" || v === "free" ? "free" : v === "yes" || v === "paid" || v === "ticket" ? "paid" : null);

  function blank(source) {
    return { feeBase: null, feeCond: [], maxBase: null, maxCond: [], ban: false, banCond: [], restricted: null, disc: false, notes: [], source };
  }

  // ---------- From OpenStreetMap tags ----------
  function fromOsm(t, prefix = "") {
    const r = blank("map");
    r.feeBase = feeValue(t[prefix + "fee"]);
    for (const c of S.conditional(t[prefix + "fee:conditional"])) {
      const v = feeValue(c.value);
      if (v) r.feeCond.push({ value: v, sched: c.sched });
    }
    r.maxBase = S.duration(t[prefix + "maxstay"]);
    for (const c of S.conditional(t[prefix + "maxstay:conditional"])) {
      const v = S.duration(c.value);
      if (v) r.maxCond.push({ value: v, sched: c.sched });
    }
    if (/disc/.test(t[prefix + "authentication:disc"] || "") || t[prefix + "authentication:disc"] === "yes") r.disc = true;
    return r;
  }

  function lotRules(t) {
    const r = fromOsm(t);
    if (/^(private|customers|permit|no|delivery|residents|employees)$/.test(t.access || "")) r.restricted = t.access === "customers" ? "Customers only" : t.access === "residents" ? "Residents only" : "Private";
    if (t.opening_hours && t.opening_hours !== "24/7") {
      const open = S.parse(t.opening_hours);
      if (open) r.banCond.push({ sched: open, invert: true, why: "closed" });
    }
    return r;
  }

  function streetRules(t, side) {
    // New scheme: parking:both=lane + parking:both:fee=…
    const v = t[`parking:${side}`];
    if (v) {
      const r = fromOsm(t, `parking:${side}:`);
      if (v === "no" || v === "separate") r.ban = true;
      const restr = t[`parking:${side}:restriction`];
      if (restr === "no_parking" || restr === "no_stopping") r.ban = true;
      if (restr === "loading_only") r.ban = true, r.notes.push("Loading only");
      if (restr === "charging") r.restricted = "EV charging only";
      if (restr === "disabled") r.restricted = "Disabled permit only";
      for (const c of S.conditional(t[`parking:${side}:restriction:conditional`])) {
        if (/no_parking|no_stopping|loading/.test(c.value)) r.banCond.push({ sched: c.sched, why: c.value.replace("_", " ") });
      }
      const acc = t[`parking:${side}:access`];
      if (/^(private|residents|permit|customers|no)$/.test(acc || "")) r.restricted = acc === "residents" ? "Residents only" : "Permit only";
      if (t[`parking:${side}:zone`]) r.notes.push("Zone " + t[`parking:${side}:zone`]);
      return r;
    }
    // Old scheme: parking:lane:both=parallel + parking:condition:both=ticket …
    const lane = t[`parking:lane:${side}`];
    const r = blank("map");
    if (/^(no_parking|no_stopping|no|fire_lane)$/.test(lane || "")) r.ban = true;
    const cond = t[`parking:condition:${side}`] || "";
    if (cond === "free") r.feeBase = "free";
    if (cond === "ticket") r.feeBase = "paid";
    if (cond === "disc") { r.feeBase = "free"; r.disc = true; }
    if (/^(no_parking|no_stopping)$/.test(cond)) r.ban = true;
    if (/^(residents|private|customers)$/.test(cond)) r.restricted = cond === "residents" ? "Residents only" : "Private";
    r.maxBase = S.duration(t[`parking:condition:${side}:maxstay`]);
    const interval = S.parse(t[`parking:condition:${side}:time_interval`]);
    if (interval && r.feeBase === "paid") { r.feeCond.push({ value: "paid", sched: interval }); r.feeBase = "free"; }
    if (interval && r.maxBase) { r.maxCond.push({ value: r.maxBase, sched: interval }); r.maxBase = null; }
    return r;
  }

  // ---------- From an AI sign reading ----------
  function fromSign(reading, at) {
    const r = blank("sign");
    r.signAt = at;
    // On Swedish signs a rule only applies at the times shown; outside them parking is free.
    r.feeBase = "free";
    for (const rule of reading.rules || []) {
      const sched = S.parse(rule.hours || rule.when, { defaultDays: WEEKDAYS }) || { always: true };
      const req = (rule.requires || "").toLowerCase();
      if (!rule.parking_allowed) r.banCond.push({ sched, why: "no parking" });
      if (rule.fee === "paid") r.feeCond.push({ value: "paid", sched });
      if (rule.fee === "free") r.feeCond.push({ value: "free", sched });
      if (rule.max_stay_minutes) r.maxCond.push({ value: rule.max_stay_minutes, sched });
      if (/disc|skiva/.test(req)) r.disc = true;
      else if (/resident|boende|permit|tillstånd|zone|zon/.test(req)) r.banCond.push({ sched, why: rule.requires });
    }
    if (reading.street_cleaning) {
      const sched = S.parse(reading.street_cleaning_hours || reading.street_cleaning, { defaultDays: WEEKDAYS });
      if (sched) r.banCond.push({ sched, why: "street cleaning" });
      else r.notes.push("Street cleaning: " + reading.street_cleaning);
    }
    if (reading.confidence === "low") r.notes.push("Sign was hard to read");
    return r;
  }

  // ---------- Evaluate a stay ----------
  function stateAt(r, t) {
    let banned = r.ban ? "no parking" : null;
    for (const b of r.banCond) {
      const m = S.matches(b.sched, t);
      if (b.invert ? !m : m) banned = b.why;
    }
    let fee = r.feeBase;
    for (const c of r.feeCond) if (S.matches(c.sched, t)) fee = c.value;
    let max = r.maxBase;
    for (const c of r.maxCond) if (S.matches(c.sched, t)) max = c.value;
    return { banned, fee, max };
  }

  // Returns { verdict, title, short, leaveBy, freeFrom, notes, source }
  // verdict: free | limited | paid | no | unknown
  function evaluate(r, start, stayMin) {
    const notes = [...r.notes];
    if (r.disc) notes.push("Needs a parking disc (P-skiva)");
    if (r.restricted) return { verdict: "no", title: r.restricted, short: r.restricted, notes, source: r.source };

    const s0 = stateAt(r, start);
    if (s0.banned) {
      // When can you park? Look ahead up to 24 h.
      let okFrom = null;
      for (let m = STEP; m <= 24 * 60; m += STEP) {
        const t = new Date(+start + m * 6e4);
        if (!stateAt(r, t).banned) { okFrom = t; break; }
      }
      const why = s0.banned === "closed" ? "Closed" : s0.banned[0].toUpperCase() + s0.banned.slice(1);
      return { verdict: "no", title: why + (okFrom && !r.ban ? ` · OK from ${fmtTime(okFrom, start)}` : ""), short: why, notes, source: r.source };
    }

    const known = s0.fee != null || r.feeCond.length || r.source === "sign";
    let leaveBy = null, why = null, freeFrom = null, paidNow = s0.fee === "paid";
    const maxNow = s0.max;
    for (let m = STEP; m < stayMin; m += STEP) {
      const t = new Date(+start + m * 6e4);
      const s = stateAt(r, t);
      if (s.banned) { leaveBy = t; why = s.banned; break; }
      if (!paidNow && s.fee === "paid") { leaveBy = t; why = "paid"; break; }
      if (paidNow && s.fee !== "paid" && !freeFrom) freeFrom = t;
    }
    if (paidNow) {
      const ff = freeFrom || (() => {
        for (let m = STEP; m <= 24 * 60; m += STEP) {
          const t = new Date(+start + m * 6e4);
          if (stateAt(r, t).fee !== "paid") return t;
        }
        return null;
      })();
      return { verdict: "paid", title: "Paid" + (ff ? ` · free from ${fmtTime(ff, start)}` : ""), short: "Paid", freeFrom: ff, notes, source: r.source, paidNow: true };
    }
    if (maxNow && maxNow < stayMin) {
      const lb = new Date(+start + maxNow * 6e4);
      if (!leaveBy || lb < leaveBy) { leaveBy = lb; why = "max " + fmtMin(maxNow); }
    }
    if (!known) {
      return { verdict: "unknown", title: "Not sure" + (maxNow ? ` · max ${fmtMin(maxNow)}` : ""), short: "Not sure", notes, source: r.source, leaveBy };
    }
    if (leaveBy) {
      const reason = why === "paid" ? "then paid" : why.startsWith("max") ? why : "then " + why;
      return { verdict: "limited", title: `Free until ${fmtTime(leaveBy, start)} (${reason})`, short: "Free until " + fmtTime(leaveBy, start), leaveBy, notes, source: r.source };
    }
    return { verdict: "free", title: "Free for your whole stay" + (maxNow ? ` (max ${fmtMin(maxNow)})` : ""), short: "Free", notes, source: r.source };
  }

  const VERDICT = {
    free: { color: "#1f9d55", label: "Free" },
    limited: { color: "#c27c0e", label: "Free for a while" },
    unknown: { color: "#8a94a6", label: "Not sure" },
    paid: { color: "#d64545", label: "Paid" },
    no: { color: "#3b3f47", label: "Not allowed" },
  };

  return { lotRules, streetRules, fromSign, evaluate, VERDICT, fmtMin, fmtTime };
})();
