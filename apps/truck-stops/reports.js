// All shared truck data the Break Planner reads and writes (Supabase, project "je-apps"):
//   truck_parking_reports   drivers say "spaces / a few / full" (read + add)
//   planned_stops           anonymous: which stop, when (read + add) → "N drivers plan to stop here"
//   truck_sites             official truck parking sites, e.g. Autobahn GmbH (read)
//   truck_site_status       live occupancy readings from official feeds (read)
//   truck_fullness_by_hour  how full each place usually is, by weekday + hour (read)
// If the server can't be reached, reports are kept on this phone only.
window.TruckReports = (() => {
  const { url, anonKey } = window.SUPABASE;
  const headers = { apikey: anonKey, Authorization: "Bearer " + anonKey, "Content-Type": "application/json" };
  const LOCAL = "truckReports:v1";
  let shared = true;

  const local = {
    all() { try { return JSON.parse(localStorage.getItem(LOCAL) || "[]"); } catch { return []; } },
    add(r) { try { localStorage.setItem(LOCAL, JSON.stringify([r, ...local.all()].slice(0, 500))); } catch {} },
  };

  async function get(path) {
    const res = await fetch(url + "/rest/v1/" + path, { headers });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  async function post(table, rows) {
    const res = await fetch(url + "/rest/v1/" + table, { method: "POST", headers, body: JSON.stringify(rows) });
    if (!res.ok) throw new Error("HTTP " + res.status);
  }
  const box = (b) => `lat=gte.${b.s}&lat=lte.${b.n}&lon=gte.${b.w}&lon=lte.${b.e}`;
  const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();

  // b = { s, w, n, e }
  async function list(b) {
    const mine = local.all().filter((r) => r.lat >= b.s && r.lat <= b.n && r.lon >= b.w && r.lon <= b.e);
    try {
      const rows = await get(`truck_parking_reports?select=place_id,status,created_at&${box(b)}&created_at=gte.${daysAgo(60)}&order=created_at.desc&limit=5000`);
      shared = true;
      return newest([...rows, ...mine.filter((m) => m.localOnly)]);
    } catch {
      shared = false;
      return newest(mine);
    }
  }

  // extra = { verified: true, distance_m } for a GPS-confirmed check-in
  async function add(place, status, extra = {}) {
    const row = { place_id: place.id, status, lat: place.lat, lon: place.lon };
    try {
      if (extra.verified) {
        try { await post("truck_parking_reports", { ...row, verified: true, distance_m: Math.round(extra.distance_m) }); }
        catch { await post("truck_parking_reports", row); } // database not upgraded for check-ins yet
      } else {
        await post("truck_parking_reports", row);
      }
      local.add({ ...row, created_at: new Date().toISOString() });
      shared = true;
      return { shared: true };
    } catch {
      local.add({ ...row, created_at: new Date().toISOString(), localOnly: true });
      shared = false;
      return { shared: false };
    }
  }

  // Everything else the planner can use. Each part fails quietly (empty) on its own.
  async function context(b, placeIds) {
    const soon = new Date(Date.now() - 3600e3).toISOString();
    const [sites, planned, live] = await Promise.all([
      get(`truck_sites?select=id,source,name,lat,lon,capacity_hgv,features,is_blocked&${box(b)}&limit=5000`).catch(() => []),
      get(`planned_stops?select=place_id,kind,arrive_at,leave_at&${box(b)}&leave_at=gte.${soon}&limit=5000`).catch(() => []),
      get(`truck_site_status?select=site_id,status,occupied,capacity,observed_at&observed_at=gte.${new Date(Date.now() - 2 * 3600e3).toISOString()}&order=observed_at.desc&limit=5000`).catch(() => []),
    ]);
    return { sites, planned, live, fullness: [] };
  }

  // Usual fullness by weekday/hour for these places (ids can be OSM or official).
  async function fullness(ids) {
    if (!ids.length) return [];
    const out = [];
    for (let i = 0; i < ids.length; i += 80) {
      const list = ids.slice(i, i + 80).map((x) => `"${String(x).replace(/"/g, "")}"`).join(",");
      out.push(...(await get(`truck_fullness_by_hour?select=site_id,dow,hour,n,fullness&site_id=in.(${encodeURIComponent(list)})`).catch(() => [])));
    }
    return out;
  }

  // Tell other drivers where we plan to stop (anonymous: place + time only).
  async function addPlanned(stops) {
    const rows = stops.filter((s) => s.chosen).map((s) => ({
      place_id: s.chosen.id, kind: s.kind, lat: s.chosen.lat, lon: s.chosen.lon,
      arrive_at: new Date(s.arrive).toISOString(), leave_at: new Date(s.leave).toISOString(),
    })).filter((r) => new Date(r.arrive_at) - Date.now() < 4 * 864e5);
    if (!rows.length) return;
    try { await post("planned_stops", rows); } catch { /* not important enough to bother the driver */ }
  }

  const newest = (rows) => rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { list, add, context, fullness, addPlanned, isShared: () => shared };
})();
