// Truck Break Planner — enter a trip and your tachograph times, get every EU
// break and daily rest placed on a truck-safe route, each at a real truck stop
// with a good chance of a free space.
const { overpass, geocode, fmtDist, pos, baseMap, locate, esc, dotIcon } = MapUtils;
const $ = (id) => document.getElementById(id);

const map = baseMap("map", [59.0, 15.0], 6); // Sweden
const routeLayer = L.layerGroup().addTo(map);
const stopLayer = L.layerGroup().addTo(map);

let fromPoint = null; // set by 📍
let trip = null; // { from, to, route, thinPts, places, reports, departAt }
let overrides = new Map(); // stop index -> chosen place id
let plan = null;

const setStatus = (msg, isError) => {
  $("status").textContent = msg || "";
  $("status").classList.toggle("error", !!isError);
};

// ---------- Inputs (remembered on this phone) ----------
const FIELDS = ["from", "to", "sinceBreak", "today", "extendedUsed", "reducedUsed", "week", "firstPart", "allowExtended", "preferReduced", "height", "width", "length", "weight", "axleLoad", "hazmat"];
const SAVE_KEY = "truckPlanner:v1";
const wants = new Set(["food", "toilets"]);

function loadInputs() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch {}
  for (const id of FIELDS) {
    if (!(id in s)) continue;
    const el = $(id);
    if (el.type === "checkbox") el.checked = !!s[id];
    else el.value = s[id];
  }
  if (Array.isArray(s.wants)) { wants.clear(); s.wants.forEach((w) => wants.add(w)); }
}
function saveInputs() {
  const s = { wants: [...wants] };
  for (const id of FIELDS) { const el = $(id); s[id] = el.type === "checkbox" ? el.checked : el.value; }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
}

const hm = (v) => { const [h, m] = String(v || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const num = (id) => parseFloat($(id).value) || 0;

function driverState() {
  return {
    sinceBreak: hm($("sinceBreak").value),
    today: Math.max(hm($("today").value), hm($("sinceBreak").value)),
    firstPartTaken: $("firstPart").checked,
    extendedUsed: +$("extendedUsed").value,
    reducedUsed: +$("reducedUsed").value,
    week: num("week") * 60,
    allowExtended: $("allowExtended").checked,
    preferReduced: $("preferReduced").checked,
  };
}
const truckSpec = () => ({ height: num("height"), width: num("width"), length: num("length"), weight: num("weight"), axleLoad: num("axleLoad"), hazmat: $("hazmat").checked });

function localInputValue(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- "Wants" chips ----------
$("wants").innerHTML = Object.entries(Stops.WANTS)
  .map(([k, w]) => `<label class="chip"><input type="checkbox" data-want="${k}" ${wants.has(k) ? "checked" : ""}/>${w.label}</label>`)
  .join("");
function syncWantChips() {
  document.querySelectorAll("[data-want]").forEach((el) => (el.checked = wants.has(el.dataset.want)));
}
$("wants").addEventListener("change", (e) => {
  const k = e.target.dataset.want;
  if (!k) return;
  e.target.checked ? wants.add(k) : wants.delete(k);
  saveInputs();
  if (trip) { overrides = new Map(); recompute(); }
});

// ---------- Planning ----------
async function planTrip(e) {
  e && e.preventDefault();
  saveInputs();
  const fromText = $("from").value.trim(), toText = $("to").value.trim();
  if (!toText || (!fromText && !fromPoint)) return setStatus("Enter where you start and where you're going.", true);
  $("go").disabled = true;
  $("timeline").innerHTML = "";
  $("summary").innerHTML = "";
  try {
    setStatus("Finding the places…");
    const from = fromPoint && (!fromText || fromText === "My location") ? { ...fromPoint, label: "My location" } : await geocode(fromText);
    const to = await geocode(toText);

    setStatus("Working out a truck-safe route…");
    const route = await RouteUtils.route(from, to, truckSpec());
    const thinPts = RouteUtils.thin(route.points, 300);

    setStatus(`Route ${Math.round(route.km)} km. Looking for truck stops along it…`);
    const places = await stopsAlongRoute(route, thinPts);

    setStatus("Checking driver reports and live data…");
    const bounds = routeBounds(route);
    const [reports, ctx] = await Promise.all([TruckReports.list(bounds), TruckReports.context(bounds)]);
    const merged = Stops.mergeSites(places, ctx.sites, (p) => RouteUtils.locateOnRoute(thinPts, p));
    const ids = [...new Set(merged.flatMap((p) => [p.id, ...(p.siteIds || [])]))];
    ctx.fullness = await TruckReports.fullness(ids);
    ctx.reports = reports;

    trip = { from, to, route, thinPts, places: merged, reports, ctx, departAt: new Date($("depart").value || Date.now()) };
    overrides = new Map();
    recompute(true);
    setStatus("");
    $("driverBox").open = false;
    $("truckBox").open = false;
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $("go").disabled = false;
  }
}

// Overpass in chunks of ~450 km so long trips don't time out.
async function stopsAlongRoute(route, thinPts) {
  const line = RouteUtils.thin(route.points, 3000);
  const chunks = [];
  for (let i = 0; i < line.length - 1; i += 150) chunks.push(line.slice(i, i + 151));
  if (!chunks.length) chunks.push(line);
  const seen = new Map();
  for (let i = 0; i < chunks.length; i++) {
    if (chunks.length > 1) setStatus(`Looking for truck stops along the route… (${i + 1}/${chunks.length})`);
    const els = await overpass(Stops.corridorQuery(chunks[i], 2000), { timeoutMs: 60000 });
    for (const el of els) seen.set(el.type + el.id, el);
  }
  return Stops.toPlaces([...seen.values()], pos)
    .map((p) => ({ ...p, ...RouteUtils.locateOnRoute(thinPts, p) }))
    .filter((p) => p.offset <= 2500);
}

function routeBounds(route) {
  let s = 90, n = -90, w = 180, e = -180;
  for (const p of route.points) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); e = Math.max(e, p.lon); }
  return { s: s - 0.05, n: n + 0.05, w: w - 0.1, e: e + 0.1 };
}

// Step through the trip: drive until the next required stop, pick the best
// truck stop shortly before that moment, stop there, repeat.
function computePlan() {
  const { route, places } = trip;
  const total = route.minutes;
  let st = Rules.initialState(driverState());
  let cur = 0; // route minute where we are
  let clock = trip.departAt.getTime();
  const stops = [];
  const want = [...wants];

  for (let guard = 0; guard < 80; guard++) {
    const ns = Rules.nextStop(st);
    if (cur + ns.maxDrive >= total - 0.5) {
      st = Rules.drive(st, total - cur);
      clock += (total - cur) * 60e3;
      break;
    }
    const limit = cur + ns.maxDrive;
    const winLen = ns.kind === "rest" ? 120 : 60;
    const startClock = clock, startCur = cur;
    const arrivalAt = (t) => new Date(startClock + (t - startCur) * 60e3);
    const pick = (lo) => places.filter((p) => p.t >= lo && p.t <= limit);
    let lo = ns.maxDrive < 15 ? cur : Math.max(cur + 10, limit - winLen);
    let cands = pick(lo);
    if (!cands.length) { lo = Math.max(cur + 5, limit - winLen * 2.5); cands = pick(lo); }
    const ranked = Stops.rank(cands, { win: [lo, limit], kind: ns.kind, wants: want, arrivalAt, ctx: trip.ctx });

    const idx = stops.length;
    const chosen = (overrides.has(idx) && ranked.find((r) => r.id === overrides.get(idx))) || ranked[0] || null;
    const stopT = chosen ? chosen.t : limit;
    st = Rules.drive(st, stopT - cur);
    const detour = chosen ? chosen.detour : 0;
    const arrive = clock + (stopT - cur + detour / 2) * 60e3;
    const leave = arrive + ns.duration * 60e3;
    const alts = ranked.slice(0, 4);
    if (chosen && !alts.includes(chosen)) alts.push(chosen);
    stops.push({
      idx, kind: ns.kind, duration: ns.duration, limit, chosen, alts, arrive, leave,
      point: chosen || RouteUtils.pointAtMinute(route, limit),
      km: (chosen ? chosen.m : RouteUtils.pointAtMinute(route, limit).m) / 1000,
      drivenBefore: st.today,
    });
    st = Rules.stop(st, ns.kind, ns.duration);
    clock = leave + (detour / 2) * 60e3;
    cur = stopT;
  }
  return { stops, arrive: clock, end: st };
}

function recompute(fit) {
  plan = computePlan();
  render(fit);
}

// ---------- Show it ----------
const fmtDur = (min) => { const m = Math.round(min); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) + " min" : ""}` : `${m} min`; };
function fmtTime(t) {
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === trip.departAt.toDateString() ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}
const KIND = {
  break: { icon: "☕", color: "#c27c0e", label: (s) => `${fmtDur(s.duration)} break` },
  rest: { icon: "🛏", color: "#7b4fd6", label: (s) => `Daily rest ${fmtDur(s.duration)}` },
};

function render(fit) {
  const { route, from, to } = trip;
  routeLayer.clearLayers();
  stopLayer.clearLayers();

  const line = L.polyline(RouteUtils.thin(route.points, 150).map((p) => [p.lat, p.lon]), {
    color: route.truckAware ? "#2f6fed" : "#c27c0e", weight: 5, opacity: 0.8, dashArray: route.truckAware ? null : "8 8",
  }).addTo(routeLayer);
  L.marker([route.points[0].lat, route.points[0].lon], { icon: dotIcon("#111", 16) }).bindPopup("Start: " + esc(from.label)).addTo(routeLayer);
  const endP = route.points[route.points.length - 1];
  L.marker([endP.lat, endP.lon], { icon: dotIcon("#2f6fed", 16) }).bindPopup("Destination: " + esc(to.label)).addTo(routeLayer);
  if (fit) map.fitBounds(line.getBounds(), { padding: [30, 30] });

  // Alternatives as small dots, chosen stops as numbered circles
  plan.stops.forEach((s, i) => {
    for (const a of s.alts) {
      if (a === s.chosen) continue;
      L.marker([a.lat, a.lon], { icon: dotIcon(Stops.TYPES[a.type].color, 11), opacity: 0.8 })
        .bindPopup(`<b>${esc(a.name)}</b><br>Option for stop ${i + 1}<br><button data-choose="${i}|${esc(a.id)}">Stop here instead</button>`)
        .addTo(stopLayer);
    }
    const k = KIND[s.kind];
    const icon = L.divIcon({ className: "", html: `<span class="num-icon" style="background:${k.color}">${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    L.marker([s.point.lat, s.point.lon], { icon, zIndexOffset: 1000 })
      .bindPopup(`<b>${i + 1}. ${k.icon} ${k.label(s)}</b><br>${s.chosen ? esc(s.chosen.name) : "No known truck stop here"}<br>${fmtTime(s.arrive)} – ${fmtTime(s.leave)}`)
      .addTo(stopLayer);
  });

  // Summary
  const driveMin = route.minutes;
  const nBreaks = plan.stops.filter((s) => s.kind === "break").length;
  const nRests = plan.stops.filter((s) => s.kind === "rest").length;
  const warnings = [];
  if (route.warning) warnings.push(route.warning);
  if (plan.end.week > Rules.LIMITS.week) warnings.push(`This trip takes you over 56 h driving this week (${fmtDur(plan.end.week)}). You need a weekly rest first.`);
  if (plan.stops.some((s) => !s.chosen)) warnings.push("For some stops we found no truck stop in OpenStreetMap. Check the area on the map and plan that one yourself.");
  if (!TruckReports.isShared()) warnings.push("Driver reports are saved on this phone only for now (the shared database isn't switched on yet).");
  $("summary").innerHTML = `
    <div class="card-box">
      <div><b>${esc(short(from.label))} → ${esc(short(to.label))}</b></div>
      <div>${Math.round(route.km)} km · ${fmtDur(driveMin)} driving · ${nBreaks} break${nBreaks === 1 ? "" : "s"}${nRests ? ` · ${nRests} night rest${nRests === 1 ? "" : "s"}` : ""}</div>
      <div>Arrive about <b>${fmtTime(plan.arrive)}</b></div>
      <div class="muted small">${route.truckAware ? `Truck-safe route for ${num("height")} m / ${num("weight")} t${$("hazmat").checked ? " / ADR" : ""}` : "Car route (not truck-checked)"} · no live traffic</div>
      ${warnings.map((w) => `<div class="warn">⚠️ ${esc(w)}</div>`).join("")}
      <a class="btn primary" id="openGoogle" target="_blank" rel="noopener" href="${esc(googleLink())}">Open in Google Maps with my stops</a>
      <div class="muted small">Google Maps isn't truck-aware. Follow the blue route above where it differs. Opening it shares your planned stops (place and time only, anonymous) so other drivers see how busy a stop will be.</div>
    </div>`;

  // Timeline
  const rows = [];
  rows.push(`<div class="stop endpoint"><div class="when">${fmtTime(trip.departAt)} · Leave</div><div class="where">${esc(short(from.label))}</div></div>`);
  plan.stops.forEach((s, i) => rows.push(stopCard(s, i)));
  rows.push(`<div class="stop endpoint"><div class="when">${fmtTime(plan.arrive)} · Arrive</div><div class="where">${esc(short(to.label))}</div>
    <div class="meta">Driving today at arrival: ${fmtDur(plan.end.today)} · since last break: ${fmtDur(plan.end.sinceBreak)}</div></div>`);
  $("timeline").innerHTML = rows.join("");
}

function stopCard(s, i) {
  const k = KIND[s.kind];
  const c = s.chosen;
  const late = s.limit - (c ? c.t : s.limit);
  const head = `<div class="when">${i + 1}. ${k.icon} ${fmtTime(s.arrive)}–${fmtTime(s.leave)} · ${k.label(s)}</div>`;
  if (!c) {
    return `<div class="stop ${s.kind}">${head}
      <div class="where">No known truck stop near km ${Math.round(s.km)}</div>
      <div class="meta">You must stop by here. Look on the map for a lay-by or parking.</div></div>`;
  }
  const t = Stops.TYPES[c.type];
  const alts = s.alts
    .map((a) => `<button type="button" class="${a === c ? "on" : ""}" data-choose="${i}|${esc(a.id)}" title="${esc(a.features.join(" · "))}">${esc(trim(a.name, 22))} · ${a.chance.label}</button>`)
    .join("");
  const missing = c.missing.length ? ` · <span class="warn">no info on ${c.missing.map((w) => Stops.WANTS[w].label.split(" ").slice(1).join(" ").toLowerCase()).join(", ")}</span>` : "";
  return `<div class="stop ${s.kind}">${head}
    <div class="where"><span class="dot" style="background:${t.color}"></span> ${esc(c.name)} <span class="badge ${c.chance.label}">Space: ${c.chance.label}</span></div>
    <div class="meta">${t.label} · km ${Math.round(c.m / 1000)}${c.detour ? ` · ${Math.round(c.detour)} min detour` : ""}${late > 5 ? ` · ${fmtDur(late)} before you must stop` : ""}</div>
    ${c.features.length ? `<div class="meta">${esc(c.features.join(" · "))}${missing}</div>` : missing ? `<div class="meta">${missing.slice(3)}</div>` : ""}
    <div class="meta" title="How we guessed">Chance of a space: ${esc(c.chance.why)}</div>
    ${c.closed ? `<div class="warn">⚠️ Closed according to the road authority</div>` : ""}
    ${c.sources && c.sources.length > 1 ? `<div class="meta">Data: ${esc(c.sources.join(" + "))}</div>` : ""}
    ${s.alts.length > 1 ? `<div class="alts">${alts}</div>` : ""}
    <div class="report">Here now? <button type="button" data-report="${i}|free">🟢 Spaces</button><button type="button" data-report="${i}|few">🟡 A few</button><button type="button" data-report="${i}|full">🔴 Full</button>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}" target="_blank" rel="noopener">Navigate</a>
      <a href="https://www.openstreetmap.org/${esc(c.id)}" target="_blank" rel="noopener">Details</a></div>
  </div>`;
}

function googleLink() {
  const { from, to } = trip;
  const ll = (p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  const wps = plan.stops.filter((s) => s.chosen).slice(0, 9).map((s) => ll(s.chosen));
  return `https://www.google.com/maps/dir/?api=1&origin=${ll(from)}&destination=${ll(to)}&travelmode=driving` + (wps.length ? `&waypoints=${encodeURIComponent(wps.join("|"))}` : "");
}

const short = (label) => String(label || "").split(",")[0];
const trim = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ---------- Clicks ----------
function onChoose(spec) {
  const [i, id] = spec.split("|");
  const idx = +i;
  // Later stops depend on this one, so let them be re-picked.
  for (const k of [...overrides.keys()]) if (k > idx) overrides.delete(k);
  overrides.set(idx, id);
  map.closePopup();
  recompute();
}
async function onReport(spec) {
  const [i, status] = spec.split("|");
  const s = plan.stops[+i];
  if (!s || !s.chosen) return;
  const res = await TruckReports.add(s.chosen, status);
  setStatus(res.shared ? "Thanks! Other drivers will see your report." : "Saved on this phone (sharing isn't switched on yet).");
  trip.reports = trip.ctx.reports = await TruckReports.list(routeBounds(trip.route));
  recompute();
}
// Leaflet stops clicks inside popups from bubbling, so wire popup buttons directly.
map.on("popupopen", (e) => {
  e.popup.getElement().querySelectorAll("[data-choose]").forEach((b) => (b.onclick = () => onChoose(b.dataset.choose)));
});
let sharedPlanKey = null;
document.addEventListener("click", (e) => {
  if (e.target.closest("#openGoogle") && plan) {
    // The driver is going with this plan: tell other drivers (anonymously) where we'll stop.
    const key = plan.stops.map((s) => (s.chosen ? s.chosen.id : "-") + "@" + Math.round(s.arrive / 6e5)).join();
    if (key !== sharedPlanKey) { sharedPlanKey = key; TruckReports.addPlanned(plan.stops); }
  }
  const c = e.target.closest("[data-choose]");
  if (c) return onChoose(c.dataset.choose);
  const r = e.target.closest("[data-report]");
  if (r) return onReport(r.dataset.report);
});

// ---------- Wire up ----------
$("tripForm").addEventListener("submit", planTrip);
$("locate").addEventListener("click", async () => {
  setStatus("Finding your location…");
  try {
    fromPoint = await locate();
    $("from").value = "My location";
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  }
});
$("from").addEventListener("input", () => { if ($("from").value !== "My location") fromPoint = null; });
FIELDS.forEach((id) => $(id).addEventListener("change", () => {
  saveInputs();
  // Changing driver times only re-runs the planning, no new downloads.
  if (trip && !["from", "to", "height", "width", "length", "weight", "axleLoad", "hazmat"].includes(id)) { overrides = new Map(); recompute(); }
}));
$("depart").addEventListener("change", () => { if (trip) { trip.departAt = new Date($("depart").value); overrides = new Map(); recompute(); } });

loadInputs();
syncWantChips();
$("depart").value = localInputValue(new Date(Math.ceil(Date.now() / 300e3) * 300e3));
if ($("from").value === "My location") $("from").value = "";
