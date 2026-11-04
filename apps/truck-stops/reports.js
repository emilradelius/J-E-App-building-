// Driver reports: "free spaces / a few left / full" at a truck stop.
// Stored in Supabase table truck_parking_reports (see supabase/migrations/)
// so every driver sees them. If the table isn't there yet, or the server
// can't be reached, reports are kept on this phone only.
window.TruckReports = (() => {
  const { url, anonKey } = window.SUPABASE;
  const headers = { apikey: anonKey, Authorization: "Bearer " + anonKey, "Content-Type": "application/json" };
  const LOCAL = "truckReports:v1";
  let shared = true; // becomes false if the shared table is missing

  const local = {
    all() { try { return JSON.parse(localStorage.getItem(LOCAL) || "[]"); } catch { return []; } },
    add(r) {
      const rows = [r, ...local.all()].slice(0, 500);
      try { localStorage.setItem(LOCAL, JSON.stringify(rows)); } catch {}
    },
  };

  // b = { s, w, n, e }
  async function list(b) {
    const mine = local.all().filter((r) => r.lat >= b.s && r.lat <= b.n && r.lon >= b.w && r.lon <= b.e);
    try {
      const since = new Date(Date.now() - 60 * 864e5).toISOString();
      const q = `truck_parking_reports?select=place_id,status,created_at&lat=gte.${b.s}&lat=lte.${b.n}&lon=gte.${b.w}&lon=lte.${b.e}&created_at=gte.${since}&order=created_at.desc&limit=3000`;
      const res = await fetch(url + "/rest/v1/" + q, { headers });
      if (!res.ok) throw new Error(res.status);
      shared = true;
      const rows = await res.json();
      return sortNewest([...rows, ...mine.filter((m) => m.localOnly)]);
    } catch {
      shared = false;
      return sortNewest(mine);
    }
  }

  async function add(place, status) {
    const row = { place_id: place.id, status, lat: place.lat, lon: place.lon };
    try {
      const res = await fetch(url + "/rest/v1/truck_parking_reports", { method: "POST", headers, body: JSON.stringify(row) });
      if (!res.ok) throw new Error(res.status);
      local.add({ ...row, created_at: new Date().toISOString() });
      shared = true;
      return { shared: true };
    } catch {
      local.add({ ...row, created_at: new Date().toISOString(), localOnly: true });
      shared = false;
      return { shared: false };
    }
  }

  const sortNewest = (rows) => rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { list, add, isShared: () => shared };
})();
