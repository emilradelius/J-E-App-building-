// Truck stops along a route: find them (OpenStreetMap via Overpass), work out
// where on the route they are, guess the chance of a free space when you
// arrive, and rank them for a break or a night's rest.
(function (root) {
  const TYPES = {
    services: { label: "Truck stop / services", color: "#2f6fed", base: 3 },
    rest_area: { label: "Rest area", color: "#1f9d55", base: 2 },
    parking: { label: "Truck parking", color: "#c27c0e", base: 2 },
    fuel: { label: "Truck fuel", color: "#d64545", base: 1 },
  };

  // Things a driver can ask for. `has` reads OpenStreetMap tags.
  const WANTS = {
    food: { label: "🍽 Food", has: (t) => yes(t.restaurant) || yes(t.food) || yes(t.fast_food) || t.amenity === "restaurant" || !!t["_food"] },
    shower: { label: "🚿 Shower", has: (t) => yes(t.shower) || yes(t.showers) },
    toilets: { label: "🚻 Toilets", has: (t) => yes(t.toilets) || !!t["_toilets"] },
    secure: { label: "🔒 Guarded / fenced", has: (t) => yes(t.supervised) || !!t.surveillance || yes(t.fenced) || /secure|säker|bewacht/i.test(t.name || "") },
  };
  const yes = (v) => v === "yes" || v === "designated" || (v && /^\d+$/.test(v));

  function classify(t) {
    if (t.highway === "services") return "services";
    if (t.highway === "rest_area") return "rest_area";
    if (t.amenity === "fuel") return "fuel";
    return "parking";
  }

  function features(t) {
    const f = [];
    if (t["capacity:hgv"]) f.push(t["capacity:hgv"] + " truck spaces");
    for (const [k, w] of Object.entries(WANTS)) if (w.has(t)) f.push(w.label.slice(w.label.indexOf(" ") + 1).toLowerCase());
    if (t.fee === "yes") f.push("paid");
    if (t.fee === "no") f.push("free of charge");
    if (t.opening_hours === "24/7") f.push("24/7");
    if (t.maxstay) f.push("max stay " + t.maxstay);
    if (t._hotel) f.push("hotel");
    if (t._docstop) f.push("DocStop (doctor for drivers)");
    if (t._sensors) f.push("space sensors");
    return f;
  }

  // Overpass query for everything within `radius` metres of the route line.
  function corridorQuery(points, radius) {
    const line = points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(",");
    const a = `around:${radius},${line}`;
    return `[out:json][timeout:90];
(
  nwr["highway"~"^(services|rest_area)$"](${a});
  nwr["amenity"="parking"]["hgv"~"^(yes|designated)$"](${a});
  nwr["amenity"="parking"]["capacity:hgv"](${a});
  nwr["amenity"="fuel"]["hgv"~"^(yes|designated)$"](${a});
  nwr["amenity"="fuel"]["fuel:HGV_diesel"="yes"](${a});
  nwr["amenity"~"^(restaurant|fast_food|toilets|shower)$"](${a});
);
out center tags 3000;`;
  }

  // Turn OSM elements into places. Restaurants/toilets are not stops on their
  // own: they are merged into a stop within 250 m (e.g. the restaurant at a services).
  function toPlaces(elements, posFn) {
    const extras = [];
    const places = [];
    for (const el of elements) {
      const p = posFn(el);
      if (!p) continue;
      const t = el.tags || {};
      if (["restaurant", "fast_food", "toilets", "shower"].includes(t.amenity)) { extras.push({ ...p, t }); continue; }
      const type = classify(t);
      places.push({ id: el.type + "/" + el.id, type, ...p, name: t.name || t.brand || t.operator || TYPES[type].label, tags: { ...t } });
    }
    for (const x of extras) {
      for (const pl of places) {
        if (Math.abs(pl.lat - x.lat) > 0.004 || Math.abs(pl.lon - x.lon) > 0.008) continue;
        if (root.RouteUtils.haversine(pl, x) > 250) continue;
        if (x.t.amenity === "restaurant" || x.t.amenity === "fast_food") pl.tags._food = x.t.name || "yes";
        if (x.t.amenity === "toilets") pl.tags._toilets = "yes";
        if (x.t.amenity === "shower") pl.tags.shower = "yes";
      }
    }
    // Same place mapped twice (e.g. services area + its truck parking): keep the
    // richer one, but remember the other's tags.
    places.sort((a, b) => TYPES[b.type].base - TYPES[a.type].base);
    const kept = [];
    for (const p of places) {
      const dup = kept.find((k) => Math.abs(k.lat - p.lat) < 0.003 && Math.abs(k.lon - p.lon) < 0.005 && root.RouteUtils.haversine(k, p) < 300);
      if (dup) { for (const [k, v] of Object.entries(p.tags)) if (!(k in dup.tags)) dup.tags[k] = v; continue; }
      kept.push(p);
    }
    for (const p of kept) p.features = features(p.tags);
    return kept;
  }

  // ---- Chance of a free truck space ----
  // A rough estimate until we have enough driver reports. European truck
  // parking fills up in the evening and is fullest overnight; daytime is easier.
  function hourPrior(h) {
    if (h >= 6 && h < 15) return 0.8;
    if (h >= 15 && h < 18) return 0.6;
    if (h >= 18 && h < 21) return 0.4;
    if (h >= 21 || h < 5) return 0.25;
    return 0.5; // 05–06
  }

  // ctx = { reports, planned, live, fullness } — see reports.js. Any part may be empty.
  //   reports:  [{ place_id, status: free|few|full, created_at }]
  //   planned:  [{ place_id, arrive_at, leave_at }]   other drivers' planned stops
  //   live:     [{ site_id, status, occupied, capacity, observed_at }]  official live feeds
  //   fullness: [{ site_id, dow (1=Mon), hour, n, fullness 0..1 }]     history
  function chanceOfSpace(place, arrival, ctx = {}) {
    const ids = new Set([place.id, ...(place.siteIds || [])]);
    const now = Date.now();
    const soon = arrival - now < 3 * 3600e3;
    let p = hourPrior(arrival.getHours());
    const cap = parseInt(place.tags["capacity:hgv"] || place.tags.capacity || "", 10);
    if (cap >= 50) p += 0.1;
    else if (cap && cap < 10) p -= 0.1;
    if (place.type === "services") p += 0.05;
    const why = ["time of day" + (cap ? `, ${cap} spaces` : "")];

    // 1. History: how full is it usually on this weekday at this hour?
    const dow = ((arrival.getDay() + 6) % 7) + 1, h = arrival.getHours();
    const hist = (ctx.fullness || []).filter((f) => ids.has(f.site_id) && f.dow === dow && Math.abs(f.hour - h) <= 1);
    const histN = hist.reduce((s, f) => s + f.n, 0);
    if (histN) {
      const avgFull = hist.reduce((s, f) => s + f.fullness * f.n, 0) / histN;
      const w = Math.min(0.85, histN * 0.1);
      p = p * (1 - w) + (1 - avgFull) * w;
      why.push(`${histN} past reading${histN > 1 ? "s" : ""} for ${["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow]} ~${h}:00`);
    }

    // 2. Other drivers who plan to be there at the same time take spaces.
    const others = (ctx.planned || []).filter((x) => ids.has(x.place_id) && new Date(x.arrive_at) <= arrival.getTime() + 3600e3 && new Date(x.leave_at) >= arrival);
    if (others.length) {
      p -= Math.min(0.3, others.length * (cap ? 1 / Math.max(cap, 5) : 0.04));
      why.push(`${others.length} other driver${others.length > 1 ? "s plan" : " plans"} to stop here then`);
    }

    // 3. Live now (only matters if we arrive within ~3 h)
    if (soon) {
      const val = { free: 0.9, few: 0.45, full: 0.05 };
      const live = (ctx.live || []).find((l) => ids.has(l.site_id) && now - new Date(l.observed_at) < 30 * 60e3);
      const rep = (ctx.reports || []).find((r) => ids.has(r.place_id) && now - new Date(r.created_at) < 2 * 3600e3);
      const hoursAhead = Math.max(0, (arrival - now) / 3600e3);
      const keep = Math.max(0.3, 1 - hoursAhead / 3); // the further ahead, the less "now" tells us
      if (live && (live.capacity > 0 || val[live.status] != null)) {
        const lp = live.capacity > 0 && live.occupied != null ? 1 - Math.min(1, live.occupied / live.capacity) : val[live.status];
        p = lp * keep + p * (1 - keep);
        why.push(`live: ${live.occupied != null && live.capacity ? `${live.capacity - live.occupied} of ${live.capacity} free` : live.status} ${Math.round((now - new Date(live.observed_at)) / 60000)} min ago`);
      } else if (rep) {
        p = val[rep.status] * keep + p * (1 - keep);
        why.push(`driver said "${rep.status}" ${Math.round((now - new Date(rep.created_at)) / 60000)} min ago`);
      }
    } else {
      // Older driver reports at a similar hour (when there is no history row yet)
      const val = { free: 0.9, few: 0.45, full: 0.05 };
      const similar = histN ? [] : (ctx.reports || []).filter((r) => {
        if (!ids.has(r.place_id)) return false;
        const rh = new Date(r.created_at).getHours();
        return Math.min(Math.abs(rh - h), 24 - Math.abs(rh - h)) <= 2 && now - new Date(r.created_at) < 60 * 864e5;
      });
      if (similar.length) {
        const avg = similar.reduce((s, r) => s + val[r.status], 0) / similar.length;
        const w = Math.min(0.8, similar.length * 0.2);
        p = p * (1 - w) + avg * w;
        why.push(`${similar.length} driver report${similar.length > 1 ? "s" : ""} around this time`);
      }
    }
    if (place.closed) { p = 0.02; why.unshift("reported CLOSED by the road authority"); }
    p = Math.min(0.95, Math.max(0.02, p));
    return { p, label: p >= 0.65 ? "Good" : p >= 0.4 ? "OK" : "Low", why: why.join(" · ") };
  }

  // Official sites (truck_sites) → join them to the OpenStreetMap stops.
  // Matched within 400 m: add capacity/facilities and remember the site id.
  // Not matched: add as a new truck parking stop.
  const SITE_FEATURES = [
    [/toilet|wc/i, "_toilets"], [/restaurant|raststätte|imbiss|gastst|kiosk|café|cafe|food/i, "_food"],
    [/dusch|shower/i, "shower"], [/überwach|bewach|video|secur|guard|polizei/i, "supervised"],
    [/hotel|motel/i, "_hotel"], [/docstop/i, "_docstop"], [/parkplatzdetektion|telematik-parken/i, "_sensors"],
  ];
  function mergeSites(places, sites, locate) {
    const out = places.slice();
    for (const s of sites) {
      const at = locate(s);
      if (at.offset > 2500) continue;
      const tags = {};
      for (const f of s.features || []) for (const [re, tag] of SITE_FEATURES) if (re.test(f)) tags[tag] = "yes";
      if (s.capacity_hgv) tags["capacity:hgv"] = String(s.capacity_hgv);
      const match = out.find((p) => Math.abs(p.lat - s.lat) < 0.005 && Math.abs(p.lon - s.lon) < 0.008 && root.RouteUtils.haversine(p, s) < 400);
      if (match) {
        match.siteIds = [...(match.siteIds || []), s.id];
        for (const [k, v] of Object.entries(tags)) if (!(k in match.tags)) match.tags[k] = v;
        if (s.is_blocked) match.closed = true;
        match.sources = [...new Set([...(match.sources || ["OpenStreetMap"]), s.source])];
        match.features = features(match.tags);
      } else {
        const p = { id: s.id, type: "parking", lat: s.lat, lon: s.lon, name: s.name || "Truck parking", tags, siteIds: [s.id], closed: !!s.is_blocked, sources: [s.source], ...at };
        p.features = features(p.tags);
        out.push(p);
      }
    }
    return out;
  }

  // Detour off the route and back, in minutes (slow roads near the exit).
  const detourMin = (offsetM) => (offsetM < 150 ? 0 : 2 + ((2 * offsetM) / 1000 / 35) * 60);

  // Rank candidates for one stop. `win` = [from, to] in route minutes; later is
  // better (uses the allowed driving time), but a good stop a bit earlier beats
  // a bad one at the limit.
  function rank(cands, { win, kind, wants, arrivalAt, ctx }) {
    const span = Math.max(1, win[1] - win[0]);
    return cands
      .map((c) => {
        const arrival = arrivalAt(c.t);
        const chance = chanceOfSpace(c, arrival, ctx);
        const matched = wants.filter((w) => WANTS[w].has(c.tags));
        const missing = wants.filter((w) => !WANTS[w].has(c.tags));
        const detour = detourMin(c.offset);
        let score = TYPES[c.type].base;
        score += 2 * ((c.t - win[0]) / span); // lateness 0..2
        score += 3 * chance.p; // 0..3
        score += 1.5 * matched.length - 0.5 * missing.length;
        score -= detour / 5;
        if (kind === "rest" && c.type === "fuel") score -= 2; // a fuel station is a poor place to sleep
        if (kind === "rest" && WANTS.secure.has(c.tags)) score += 1;
        if (c.closed) score -= 20;
        return { ...c, arrival, chance, matched, missing, detour, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  const api = { TYPES, WANTS, corridorQuery, toPlaces, chanceOfSpace, hourPrior, rank, detourMin, features, mergeSites };
  root.Stops = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
