// "Check in where I'm parked": the phone's GPS confirms the driver is at a
// truck stop (within 500 m), then one tap says how full it is. These
// GPS-confirmed reports are the most trustworthy data we have, and count
// double in the fullness history. We send the distance to the stop, never
// the driver's own position.
// Uses `trip` from plan.js when a trip is planned (same page, shared scope).
(() => {
  const { overpass, pos, locate, esc, fmtDist } = MapUtils;
  const MAX_M = 500;
  const box = document.getElementById("checkinBox");
  let here = null, options = [], idx = 0;

  async function placesNear(me) {
    // Planned trip: its stops are already loaded.
    if (typeof trip !== "undefined" && trip && trip.places) {
      const near = trip.places.filter((p) => RouteUtils.haversine(me, p) <= MAX_M);
      if (near.length) return near;
    }
    // Otherwise ask OpenStreetMap + our official sites around this point.
    const line = [{ lat: me.lat, lon: me.lon }];
    const els = await overpass(Stops.corridorQuery(line, MAX_M), { timeoutMs: 25000 });
    const osm = Stops.toPlaces(els, pos);
    const d = 0.01;
    const ctx = await TruckReports.context({ s: me.lat - d, n: me.lat + d, w: me.lon - 2 * d, e: me.lon + 2 * d });
    const dist = (p) => ({ offset: RouteUtils.haversine(me, p), t: 0, m: 0 });
    return Stops.mergeSites(osm.map((p) => ({ ...p, ...dist(p) })), ctx.sites, dist)
      .filter((p) => RouteUtils.haversine(me, p) <= MAX_M);
  }

  async function start() {
    box.innerHTML = `<div class="card-box small">Finding where you are…</div>`;
    try {
      here = await locate();
      options = (await placesNear(here))
        .map((p) => ({ ...p, dist: RouteUtils.haversine(here, p) }))
        .sort((a, b) => a.dist - b.dist);
      idx = 0;
      show();
    } catch (e) {
      box.innerHTML = `<div class="card-box small error">${esc(e.message)} <button type="button" data-ci="close">OK</button></div>`;
    }
  }

  function show() {
    const p = options[idx];
    if (!p) {
      box.innerHTML = `<div class="card-box small">
        <b>No known truck stop within ${MAX_M} m.</b>
        Is this a place where trucks can park? Add it, and say how full it is:
        <div class="report"><button type="button" data-ci="new|free">🟢 Spaces</button><button type="button" data-ci="new|few">🟡 A few</button><button type="button" data-ci="new|full">🔴 Full</button>
        <button type="button" data-ci="close">Cancel</button></div></div>`;
      return;
    }
    box.innerHTML = `<div class="card-box small">
      <div>📍 You're at <b>${esc(p.name)}</b> (${fmtDist(p.dist)} away). How full is it right now?</div>
      <div class="report"><button type="button" data-ci="ok|free">🟢 Plenty of space</button><button type="button" data-ci="ok|few">🟡 A few left</button><button type="button" data-ci="ok|full">🔴 Full</button></div>
      <div class="report">${options.length > 1 ? `<button type="button" data-ci="next">Not this place</button>` : ""}<button type="button" data-ci="close">Cancel</button></div>
    </div>`;
  }

  async function save(place, status, dist) {
    const res = await TruckReports.add(place, status, { verified: true, distance_m: dist });
    box.innerHTML = `<div class="card-box small">✅ Checked in at <b>${esc(place.name)}</b>. ${res.shared ? "Other drivers will see it now." : "Saved on this phone (no connection)."} Thanks!</div>`;
    setTimeout(() => (box.innerHTML = ""), 6000);
    if (typeof trip !== "undefined" && trip && trip.ctx) {
      trip.reports = trip.ctx.reports = await TruckReports.list(routeBounds(trip.route));
      recompute();
    }
  }

  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ci]");
    if (!b) return;
    const [what, status] = b.dataset.ci.split("|");
    if (what === "close") box.innerHTML = "";
    else if (what === "next") { idx++; show(); }
    else if (what === "ok") save(options[idx], status, options[idx].dist);
    else if (what === "new") {
      // A new place found by a driver: id from its rounded position (~10 m)
      const lat = +here.lat.toFixed(4), lon = +here.lon.toFixed(4);
      save({ id: `gps:${lat},${lon}`, name: "New truck parking spot", lat, lon }, status, 0);
    }
  });
  document.getElementById("checkin").addEventListener("click", start);
})();
