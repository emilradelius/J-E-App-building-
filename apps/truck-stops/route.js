// Truck routing + helpers to work with a route line.
//
// Routing: Valhalla "truck" profile on the free FOSSGIS server (the same one
// openstreetmap.org uses). It avoids roads that are too low, too narrow or too
// weak for the truck you enter, using OpenStreetMap restriction data
// (maxheight, maxweight, hgv=no ...). No live traffic.
// If that server fails we fall back to normal car routing (OSRM) and warn.
(function (root) {
  const VALHALLA = "https://valhalla1.openstreetmap.de/route";
  const OSRM = "https://routing.openstreetmap.de/routed-car/route/v1/driving/";
  const TRUCK_TOP_SPEED = 85; // km/h — EU trucks are limited to 90, most roads 80

  // Decode a Google-style encoded polyline (Valhalla uses precision 6).
  function decode(str, precision = 6) {
    const f = 10 ** precision;
    const pts = [];
    let i = 0, lat = 0, lon = 0;
    while (i < str.length) {
      for (const which of [0, 1]) {
        let shift = 0, result = 0, b;
        do {
          b = str.charCodeAt(i++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const d = result & 1 ? ~(result >> 1) : result >> 1;
        if (which === 0) lat += d; else lon += d;
      }
      pts.push({ lat: lat / f, lon: lon / f });
    }
    return pts;
  }

  function haversine(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Build a route object: points with cumulative metres (m) and driving minutes (t).
  // segMin[i] = minutes to drive from point i to i+1.
  function buildRoute(points, segMin, meta) {
    const pts = points.map((p) => ({ lat: p.lat, lon: p.lon, m: 0, t: 0 }));
    for (let i = 1; i < pts.length; i++) {
      pts[i].m = pts[i - 1].m + haversine(pts[i - 1], pts[i]);
      pts[i].t = pts[i - 1].t + (segMin[i - 1] || 0);
    }
    const last = pts[pts.length - 1] || { m: 0, t: 0 };
    return { points: pts, km: last.m / 1000, minutes: last.t, ...meta };
  }

  // Spread each maneuver's time over its points, in proportion to distance.
  function segTimesFromManeuvers(points, maneuvers) {
    const seg = new Array(Math.max(0, points.length - 1)).fill(0);
    for (const mv of maneuvers) {
      const a = mv.begin_shape_index, b = mv.end_shape_index;
      if (b <= a) continue;
      let len = 0;
      for (let i = a; i < b; i++) len += haversine(points[i], points[i + 1]);
      for (let i = a; i < b; i++) {
        const share = len > 0 ? haversine(points[i], points[i + 1]) / len : 1 / (b - a);
        seg[i] = (mv.time / 60) * share;
      }
    }
    return seg;
  }

  async function valhallaTruck(from, to, truck) {
    const body = {
      locations: [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }],
      costing: "truck",
      costing_options: {
        truck: {
          height: truck.height, // metres
          width: truck.width,
          length: truck.length,
          weight: truck.weight, // tonnes
          axle_load: truck.axleLoad,
          hazmat: !!truck.hazmat,
          top_speed: TRUCK_TOP_SPEED,
        },
      },
      units: "kilometers",
      directions_options: { units: "kilometers" },
    };
    const res = await fetchWithTimeout(VALHALLA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 30000);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.trip) throw new Error(json.error || "Truck routing failed (" + res.status + ")");
    const leg = json.trip.legs[0];
    const points = decode(leg.shape, 6);
    const seg = segTimesFromManeuvers(points, leg.maneuvers || []);
    return buildRoute(points, seg, { truckAware: true, source: "Valhalla truck (OpenStreetMap)" });
  }

  async function osrmCar(from, to) {
    const url = `${OSRM}${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=polyline6&annotations=duration`;
    const res = await fetchWithTimeout(url, {}, 25000);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.routes || !json.routes.length) throw new Error("Routing failed (" + res.status + ")");
    const r = json.routes[0];
    const points = decode(r.geometry, 6);
    const durations = (r.legs[0].annotation && r.legs[0].annotation.duration) || [];
    // A truck can't go faster than ~85 km/h: slow down any faster segment.
    const seg = points.slice(1).map((p, i) => {
      const meters = haversine(points[i], p);
      const carMin = (durations[i] || 0) / 60;
      return Math.max(carMin, meters / 1000 / TRUCK_TOP_SPEED * 60);
    });
    return buildRoute(points, seg, { truckAware: false, source: "OSRM car route, slowed to truck speed" });
  }

  async function route(from, to, truck) {
    try {
      return await valhallaTruck(from, to, truck);
    } catch (e) {
      const r = await osrmCar(from, to);
      r.warning = "Truck routing server didn't answer (" + e.message + "). This is a normal car route: it does NOT check bridge heights or weight limits.";
      return r;
    }
  }

  async function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "no answer in time" : "network error");
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Working with the route line ----

  // Keep about one point every `stepM` metres (for Overpass queries and drawing).
  function thin(points, stepM) {
    if (!points.length) return [];
    const out = [points[0]];
    for (const p of points) if (p.m - out[out.length - 1].m >= stepM) out.push(p);
    const last = points[points.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    return out;
  }

  // Point on the route after `min` minutes of driving.
  function pointAtMinute(rt, min) {
    const pts = rt.points;
    if (min <= 0) return pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].t >= min) {
        const a = pts[i - 1], b = pts[i];
        const f = b.t > a.t ? (min - a.t) / (b.t - a.t) : 0;
        return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, m: a.m + (b.m - a.m) * f, t: min };
      }
    }
    return pts[pts.length - 1];
  }

  // Where along the route is a place? Returns { t, m, offset } — minutes and metres
  // from the start at the closest route point, and the straight distance off the route.
  // `pts` should be a thinned point list (≈ every 300 m) for speed.
  function locateOnRoute(pts, place) {
    let best = { offset: Infinity, t: 0, m: 0 };
    const kx = Math.cos((place.lat * Math.PI) / 180);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      // Project in a flat local frame (fine for distances of a few km)
      const ax = (a.lon - place.lon) * kx, ay = a.lat - place.lat;
      const bx = (b.lon - place.lon) * kx, by = b.lat - place.lat;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const f = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
      const px = ax + dx * f, py = ay + dy * f;
      const d = Math.sqrt(px * px + py * py) * 111320;
      if (d < best.offset) best = { offset: d, t: a.t + (b.t - a.t) * f, m: a.m + (b.m - a.m) * f };
    }
    return best;
  }

  const api = { route, decode, haversine, buildRoute, segTimesFromManeuvers, thin, pointAtMinute, locateOnRoute };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RouteUtils = api;
})(typeof window !== "undefined" ? window : globalThis);
