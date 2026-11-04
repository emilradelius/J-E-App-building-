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

  // reports: [{ place_id, status: free|few|full, created_at }]
  function chanceOfSpace(place, arrival, reports) {
    let p = hourPrior(arrival.getHours());
    const cap = parseInt(place.tags["capacity:hgv"] || place.tags.capacity || "", 10);
    if (cap >= 50) p += 0.1;
    else if (cap && cap < 10) p -= 0.1;
    if (place.type === "services") p += 0.05;
    let why = "estimate from time of day" + (cap ? ` and ${cap} spaces` : "");

    const mine = (reports || []).filter((r) => r.place_id === place.id);
    const val = { free: 0.9, few: 0.45, full: 0.05 };
    // Reports from the last 2 hours say most about "now" — only useful if we arrive soon.
    const soon = arrival - Date.now() < 3 * 3600e3;
    const recent = mine.filter((r) => Date.now() - new Date(r.created_at) < 2 * 3600e3);
    if (soon && recent.length) {
      const r = recent[0];
      p = val[r.status];
      why = `driver reported "${r.status}" ${Math.round((Date.now() - new Date(r.created_at)) / 60000)} min ago`;
    } else {
      // Reports at a similar time of day (±2 h) in the last 60 days
      const h = arrival.getHours();
      const similar = mine.filter((r) => {
        const rh = new Date(r.created_at).getHours();
        const d = Math.min(Math.abs(rh - h), 24 - Math.abs(rh - h));
        return d <= 2 && Date.now() - new Date(r.created_at) < 60 * 864e5;
      });
      if (similar.length) {
        const avg = similar.reduce((s, r) => s + val[r.status], 0) / similar.length;
        const w = Math.min(0.8, similar.length * 0.2);
        p = p * (1 - w) + avg * w;
        why = `${similar.length} driver report${similar.length > 1 ? "s" : ""} around this time`;
      }
    }
    p = Math.min(0.95, Math.max(0.05, p));
    return { p, label: p >= 0.65 ? "Good" : p >= 0.4 ? "OK" : "Low", why };
  }

  // Detour off the route and back, in minutes (slow roads near the exit).
  const detourMin = (offsetM) => (offsetM < 150 ? 0 : 2 + ((2 * offsetM) / 1000 / 35) * 60);

  // Rank candidates for one stop. `win` = [from, to] in route minutes; later is
  // better (uses the allowed driving time), but a good stop a bit earlier beats
  // a bad one at the limit.
  function rank(cands, { win, kind, wants, arrivalAt, reports }) {
    const span = Math.max(1, win[1] - win[0]);
    return cands
      .map((c) => {
        const arrival = arrivalAt(c.t);
        const chance = chanceOfSpace(c, arrival, reports);
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
        return { ...c, arrival, chance, matched, missing, detour, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  const api = { TYPES, WANTS, corridorQuery, toPlaces, chanceOfSpace, hourPrior, rank, detourMin, features };
  root.Stops = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
