// Chance of finding a free space, v2.
//
// How it works, in plain words:
//  1. How full is it usually? We look at what is around the destination in
//     OpenStreetMap (shops, restaurants/bars, offices/schools, homes). Each kind
//     of place has its own busy hours: offices fill streets on weekday daytime,
//     homes fill them at night, bars in the evening, shops on Saturday midday.
//     Mixing those curves gives "how full this area usually is" for any hour.
//  2. How many spaces? Car parks use their capacity; street parking uses the
//     street's length (about one car per 6 m per side).
//  3. Many spaces beat few: if a street is 90 % full but has 30 spaces, a free
//     one is still likely. 3 spaces at 90 % full is a long shot.
//  4. What people saw beats our guess: "Found a spot" / "It was full" taps at
//     that place (and, a little, nearby) around the same time of day pull the
//     number toward reality. Taps from the last hour count most.
//  5. Area chance: several options close together add up, so we also show the
//     chance of finding *something* within walking distance, and which hour is best.
//
// It is still an estimate. The more people tap, the better it gets.
window.ParkingModel = (() => {
  const S = window.Schedule;
  // Occupancy (0 = empty, 1 = full) by hour, for a busy city area. [weekday, saturday, sunday]
  const C = {
    work: [
      [.1,.1,.1,.1,.1,.12,.2,.4,.7,.88,.9,.9,.9,.9,.9,.85,.75,.55,.35,.25,.2,.15,.12,.1],
      [.1,.1,.1,.1,.1,.1,.1,.12,.18,.25,.3,.3,.3,.3,.28,.25,.2,.18,.15,.12,.1,.1,.1,.1],
      [.08,.08,.08,.08,.08,.08,.08,.08,.1,.12,.15,.15,.15,.15,.15,.12,.12,.1,.1,.1,.08,.08,.08,.08],
    ],
    shop: [
      [.1,.1,.1,.1,.1,.1,.12,.18,.25,.35,.55,.7,.78,.78,.75,.75,.8,.8,.68,.5,.32,.2,.15,.12],
      [.12,.1,.1,.1,.1,.1,.1,.12,.2,.4,.65,.85,.92,.92,.88,.78,.62,.45,.32,.25,.2,.18,.15,.12],
      [.1,.1,.1,.1,.1,.1,.1,.1,.12,.2,.35,.5,.6,.6,.58,.5,.4,.3,.2,.15,.12,.1,.1,.1],
    ],
    food: [
      [.3,.2,.12,.1,.1,.1,.1,.12,.18,.22,.3,.5,.65,.5,.35,.32,.4,.6,.8,.82,.72,.55,.45,.38],
      [.45,.35,.2,.12,.1,.1,.1,.1,.15,.25,.35,.55,.68,.6,.5,.48,.55,.72,.88,.92,.85,.72,.6,.52],
      [.4,.3,.15,.1,.1,.1,.1,.1,.12,.25,.4,.55,.62,.55,.45,.4,.42,.55,.62,.55,.42,.3,.25,.2],
    ],
    home: [
      [.9,.9,.9,.9,.9,.88,.82,.7,.58,.5,.48,.48,.48,.48,.5,.55,.62,.72,.82,.87,.9,.9,.9,.9],
      [.9,.9,.9,.9,.9,.9,.9,.88,.84,.78,.72,.68,.66,.66,.68,.7,.74,.8,.85,.88,.9,.9,.9,.9],
      [.9,.9,.9,.9,.9,.9,.9,.9,.88,.84,.8,.76,.74,.74,.76,.78,.8,.84,.87,.9,.9,.9,.9,.9],
    ],
  };
  const LABEL = { work: "offices & schools", shop: "shops", food: "restaurants & bars", home: "homes" };

  // ---------- Area activity from OpenStreetMap ----------
  function activityQuery(p, r = 400) {
    const a = `(around:${r},${p.lat.toFixed(5)},${p.lon.toFixed(5)})`;
    return `[out:json][timeout:20];
nwr["shop"]${a};out count;
nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|nightclub|cinema|theatre)$"]${a};out count;
(nwr["office"]${a};nwr["amenity"~"^(school|university|college|hospital|clinic|townhall|kindergarten)$"]${a};);out count;
way["building"~"^(apartments|residential)$"]${a};out count;
way["building"~"^(house|detached|semidetached_house|terrace)$"]${a};out count;`;
  }
  function parseActivity(elements) {
    const n = elements.filter((e) => e.type === "count").map((e) => +e.tags.total || 0);
    const [shops = 0, food = 0, work = 0, flats = 0, houses = 0] = n;
    return { shops, food, work, flats, houses };
  }
  // Pressure from each kind of place: 0 (none around) … 0.9 (lots of it).
  const SATURATE = { shop: 60, food: 50, work: 40, home: 300 };
  function areaProfile(act) {
    const known = !!act;
    if (!act) act = { shops: 15, food: 10, work: 8, flats: 40, houses: 10 }; // until loaded: "typical town street"
    const count = { shop: act.shops, food: act.food, work: act.work, home: act.flats * 3 + act.houses * 0.3 };
    const L = {};
    for (const k in count) L[k] = Math.min(0.9, Math.log10(1 + count[k]) / Math.log10(1 + SATURATE[k]));
    const top = Object.entries(L).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0.45).slice(0, 2).map(([k]) => LABEL[k]);
    return { L, known, label: top.join(" & ") || "quiet area", villas: act.houses > 3 * act.flats + 10 };
  }

  // How full is a spot usually at time t (0..1)?
  // Each kind of place "claims" spaces at its busy hours; a space is taken if any of them claims it.
  const CLAIM = { street: { shop: 0.6, food: 0.6, work: 0.6, home: 1.0 }, lot: { shop: 0.7, food: 0.6, work: 0.7, home: 0.4 } };
  function occupancy(spot, t, area, paidNow) {
    const day = S.signDay(t);
    const row = day === 0 ? 2 : day === 6 ? 1 : 0;
    const h = t.getHours(), next = (h + 1) % 24, f = t.getMinutes() / 60;
    const curve = (k) => C[k][row][h] * (1 - f) + C[k][row][next] * f;
    const a = CLAIM[spot.kind === "lot" ? "lot" : "street"];
    let free = 1;
    for (const k in area.L) free *= 1 - a[k] * area.L[k] * curve(k);
    let o = 1 - free;
    if (area.villas && spot.kind === "street") o -= 0.15; // villa areas: cars stand on driveways
    if (paidNow) o -= 0.12; // paying makes people leave sooner or park elsewhere
    else if (o > 0.5) o += 0.05; // free spots go first when it's busy
    if (spot.capacity >= 200) o -= 0.06;
    return Math.max(0.03, Math.min(0.98, o));
  }

  // Number of spaces
  const LOT_DEFAULT = { "Parking garage": 250, "Underground garage": 120, "Rooftop car park": 80, "Car park": 25 };
  function spaces(spot) {
    if (spot.capacity > 0) return spot.capacity;
    if (spot.kind === "street") return Math.max(1, Math.round((spot.length / 6) * (spot.sides || 1) * 0.7));
    return LOT_DEFAULT[spot.type] || 20;
  }

  // ---------- People's check-ins ----------
  const PRIOR = 3; // our guess counts like 3 check-ins
  const NEAR_M = 200;
  const weekend = (d) => d === 0 || d === 6;

  function evidence(spot, t, checkins, distanceFn) {
    let found = 0, total = 0, count = 0;
    const now = Date.now();
    const soon = Math.abs(+t - now) < 3600e3; // arriving within the hour → live reports matter
    const th = t.getHours() + t.getMinutes() / 60;
    for (const c of checkins) {
      const same = c.spot === spot.id;
      let w = same ? 1 : 0;
      if (!same) {
        if (c.lat == null) continue;
        const d = distanceFn(spot, c);
        if (d > NEAR_M) continue;
        w = 0.25 * (1 - d / NEAR_M);
      }
      const at = new Date(c.at);
      const age = now - at;
      if (soon && age < 3600e3) w *= 3; // happening right now
      else {
        if (weekend(S.signDay(at)) !== weekend(S.signDay(t))) continue;
        const ch = at.getHours() + at.getMinutes() / 60;
        const dh = Math.min(Math.abs(ch - th), 24 - Math.abs(ch - th));
        w *= Math.exp(-0.5 * dh * dh); // ±1 h counts most, ±3 h hardly
        w *= Math.pow(0.5, age / (90 * 864e5)); // older than 3 months counts half
      }
      if (w < 0.02) continue;
      total += w;
      if (c.found) found += w;
      if (same) count++;
    }
    return { found, total, count };
  }

  // Main estimate for one spot.
  function estimate(spot, t, { area, checkins = [], paidNow = false, distanceFn }) {
    const o = occupancy(spot, t, area, paidNow);
    const n = spaces(spot);
    const nEff = 1 + (n - 1) * 0.3; // spaces aren't independent, and you won't check them all
    const prior = Math.max(0.03, Math.min(0.97, 1 - Math.pow(o, nEff)));
    const ev = evidence(spot, t, checkins, distanceFn);
    const p = (prior * PRIOR + ev.found) / (PRIOR + ev.total);
    return { p, prior, occupancy: o, spaces: n, reports: ev.count, label: p >= 0.6 ? "Good" : p >= 0.35 ? "Fair" : "Low" };
  }

  // Chance of finding at least one of several options. Options next to each
  // other fill up together, so we only count each one half.
  function combine(ps) {
    let miss = 1;
    for (const p of ps) miss *= Math.pow(1 - p, 0.5);
    return Math.min(0.99, 1 - miss);
  }

  const COLOR = { Good: "var(--ok)", Fair: "var(--warn)", Low: "var(--bad)" };

  return { activityQuery, parseActivity, areaProfile, estimate, combine, occupancy, spaces, COLOR };
})();
