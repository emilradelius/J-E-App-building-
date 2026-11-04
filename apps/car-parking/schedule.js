// Time rules: "when does this rule apply?"
//
// Understands the OpenStreetMap style ("Mo-Fr 08:00-18:00; Sa 09:00-15:00; PH off")
// and the looser text our AI sign reader writes ("Mon-Fri 08-18", "Sat 10-15", "always").
//
// Swedish signs: plain times = weekdays, (times in brackets) = Saturdays and the day
// before a holiday, red times = Sundays and holidays. So we treat a public holiday
// like a Sunday, and the day before a holiday like a Saturday.
window.Schedule = (() => {
  // ---------- Swedish public holidays ----------
  function easter(y) {
    // Anonymous Gregorian algorithm
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const holidayCache = {};
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    const e = easter(y);
    const firstOnOrAfter = (month, day, weekday) => {
      const d = new Date(y, month, day);
      return addDays(d, (weekday - d.getDay() + 7) % 7);
    };
    const list = [
      new Date(y, 0, 1), new Date(y, 0, 6), addDays(e, -2), e, addDays(e, 1), new Date(y, 4, 1),
      addDays(e, 39), addDays(e, 49), new Date(y, 5, 6),
      firstOnOrAfter(5, 19, 5), firstOnOrAfter(5, 20, 6), // Midsummer Eve (Fri) and Midsummer Day (Sat)
      firstOnOrAfter(9, 31, 6), // All Saints' Day (Sat between 31 Oct and 6 Nov)
      new Date(y, 11, 24), new Date(y, 11, 25), new Date(y, 11, 26), new Date(y, 11, 31),
      // Midsummer Eve, Christmas Eve and New Year's Eve are not official holidays,
      // but Swedish traffic rules treat them like holidays for signs.
    ];
    return (holidayCache[y] = new Set(list.map(key)));
  }
  const isHoliday = (d) => holidays(d.getFullYear()).has(key(d));

  // Which "kind of day" a date counts as on a sign: 0 = Sunday … 6 = Saturday
  function signDay(d) {
    if (isHoliday(d)) return 0;
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5 && isHoliday(addDays(d, 1))) return 6;
    return wd;
  }

  // ---------- Parsing ----------
  const DAY = {
    mo: 1, mon: 1, monday: 1, mån: 1, måndag: 1,
    tu: 2, tue: 2, tues: 2, tuesday: 2, tis: 2, tisdag: 2,
    we: 3, wed: 3, wednesday: 3, ons: 3, onsdag: 3,
    th: 4, thu: 4, thur: 4, thurs: 4, thursday: 4, tor: 4, tors: 4, torsdag: 4,
    fr: 5, fri: 5, friday: 5, fre: 5, fredag: 5,
    sa: 6, sat: 6, saturday: 6, saturdays: 6, lör: 6, lor: 6, lördag: 6, lördagar: 6,
    su: 0, sun: 0, sunday: 0, sundays: 0, sön: 0, son: 0, söndag: 0, söndagar: 0,
  };
  const WEEKDAYS = [1, 2, 3, 4, 5];

  function dayList(text) {
    const t = text.toLowerCase();
    const days = new Set();
    let ph = false;
    if (/\b(weekdays?|vardag(ar)?|mon(day)?\s*(-|–|to)\s*fri(day)?)\b/.test(t)) WEEKDAYS.forEach((d) => days.add(d));
    if (/\bph\b|holiday|helgdag|röd/.test(t)) ph = true;
    if (/\bweekends?\b|\bhelg(er)?\b/.test(t)) { days.add(6); days.add(0); }
    // ranges like Mo-Fr, mån–fre
    const word = "([a-zåäö]{2,9})";
    const rangeRe = new RegExp(word + "\\s*(?:-|–|—|to)\\s*" + word, "g");
    let m;
    const used = [];
    while ((m = rangeRe.exec(t))) {
      const a = DAY[m[1]], b = DAY[m[2]];
      if (a != null && b != null) {
        for (let d = a, n = 0; n < 7; d = (d + 1) % 7, n++) { days.add(d); if (d === b) break; }
        used.push(m[0]);
      }
    }
    let rest = t;
    used.forEach((u) => (rest = rest.replace(u, " ")));
    for (const w of rest.split(/[^a-zåäö]+/)) if (DAY[w] != null) days.add(DAY[w]);
    return { days, ph };
  }

  // "08:00-18:00", "8-18", "8.00–18.00", "08 - 18"
  const TIME = "(\\d{1,2})(?:[:.](\\d{2}))?";
  const RANGE_RE = new RegExp(TIME + "\\s*(?:-|–|—|to)\\s*" + TIME, "g");

  function parseOne(part, defaultDays) {
    const p = part.trim();
    if (!p) return null;
    if (/^(24\/7|always|alltid|all times|hela dygnet|dygnet runt)$/i.test(p)) return { always: true };
    const off = /\boff\b|\bclosed\b/i.test(p);
    const times = [];
    let m;
    RANGE_RE.lastIndex = 0;
    while ((m = RANGE_RE.exec(p))) {
      const from = +m[1] * 60 + +(m[2] || 0), to = +m[3] * 60 + +(m[4] || 0);
      if (from <= 24 * 60 && to <= 24 * 60) times.push([from, to === 0 ? 24 * 60 : to]);
    }
    const dayText = p.replace(RANGE_RE, " ");
    const { days, ph } = dayList(dayText);
    if (!days.size && !ph) (defaultDays || [0, 1, 2, 3, 4, 5, 6]).forEach((d) => days.add(d));
    if (!times.length) times.push([0, 24 * 60]);
    return { days, ph, times, off };
  }

  // Returns { always } or { parts: [...] } or null if we can't read it.
  function parse(text, { defaultDays } = {}) {
    if (text == null) return null;
    const s = String(text).trim().replace(/^\(|\)$/g, "");
    if (!s) return null;
    if (/^(24\/7|always|alltid|all times|dygnet runt)$/i.test(s)) return { always: true };
    const parts = s.split(/;|\n/).map((x) => parseOne(x, defaultDays)).filter(Boolean);
    if (!parts.length) return null;
    if (parts.some((x) => x.always)) return { always: true };
    // Must have found at least a time or a day, otherwise it's free text we don't understand
    const understood = /\d|mo|tu|we|th|fr|sa|su|mån|tis|ons|tor|fre|lör|sön|ph|weekday|vardag|holiday|weekend/i.test(s);
    return understood ? { parts } : null;
  }

  // Does the rule apply at time t?
  function matches(sched, t) {
    if (!sched) return false;
    if (sched.always) return true;
    const mins = t.getHours() * 60 + t.getMinutes();
    const today = signDay(t), hol = isHoliday(t);
    const y = addDays(t, -1);
    const yday = signDay(y), yhol = isHoliday(y);
    let hit = false;
    for (const p of sched.parts) {
      const dayOk = (d, h) => (h && p.ph) || p.days.has(d);
      for (const [from, to] of p.times) {
        let inside = false;
        if (from < to) inside = dayOk(today, hol) && mins >= from && mins < to;
        else inside = (dayOk(today, hol) && mins >= from) || (dayOk(yday, yhol) && mins < to);
        if (inside) hit = !p.off; // later parts override earlier ones, like OSM
      }
    }
    return hit;
  }

  // "2 hours", "2 h", "90 min", "2 tim", "1:30" → minutes
  function duration(text) {
    if (text == null) return null;
    const s = String(text).toLowerCase().trim();
    let m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return +m[1] * 60 + +m[2];
    m = s.match(/([\d.,]+)\s*(h|hr|hrs|hour|hours|tim|timmar|t)\b/);
    if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
    m = s.match(/([\d.,]+)\s*(m|min|mins|minute|minutes|minuter)\b/);
    if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
    m = s.match(/([\d.,]+)\s*(d|day|days|dygn)\b/);
    if (m) return Math.round(parseFloat(m[1]) * 1440);
    m = s.match(/^\d+$/);
    if (m) return +s; // OSM default unit is minutes
    return null;
  }

  // "no @ (Mo-Fr 18:00-08:00); yes @ Sa" → [{ value: "no", sched }, …]
  function conditional(text) {
    if (!text) return [];
    const out = [];
    let depth = 0, cur = "";
    const pieces = [];
    for (const ch of String(text)) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === ";" && depth === 0) { pieces.push(cur); cur = ""; } else cur += ch;
    }
    pieces.push(cur);
    for (const piece of pieces) {
      const [value, cond] = piece.split("@").map((x) => x && x.trim());
      if (!value || !cond) continue;
      const sched = parse(cond.replace(/^\(|\)$/g, ""));
      if (sched) out.push({ value, sched });
    }
    return out;
  }

  return { parse, matches, duration, conditional, isHoliday, signDay };
})();
