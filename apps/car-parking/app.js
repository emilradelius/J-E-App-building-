// Car Parking Finder — v1
// 1. Pick a destination → car parks + street parking from OpenStreetMap.
// 2. Each spot gets a "chance of a free spot" for your arrival time (model.js).
// 3. People improve it: "Found a spot" / "It was full" taps + photo reports (reports.js).
const { overpass, geocode, distance, fmtDist, pos, baseMap, locate, esc, dotIcon } = MapUtils;
const { estimate, COLOR: CHANCE_COLOR } = ParkingModel;
const { TYPES: REPORT_TYPES, store, shrinkPhoto } = Reports;

const FEE_COLORS = { free: "#1f9d55", paid: "#d64545", unknown: "#8a94a6" };
const TYPE_LABEL = {
  "multi-storey": "Parking garage",
  underground: "Underground garage",
  surface: "Car park",
  rooftop: "Rooftop car park",
  street_side: "Street-side parking",
  lane: "Street parking",
  layby: "Lay-by",
  carports: "Carports",
  garage_boxes: "Garages",
};
const PRIVATE = /^(private|customers|permit|no|delivery|residents|employees)$/;
const STREET_KEYS = "^parking:(lane:)?(both|left|right)$";
const STREET_VALUES = "^(lane|street_side|on_kerb|half_on_kerb|shoulder|yes|parallel|diagonal|perpendicular|marked)$";

const map = baseMap("map", [55.6050, 13.0007], 15); // Malmö centre
const spotLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
let dest = null, destMarker = null, radiusCircle = null;
let lots = [], streets = [], checkins = [];
let loadId = 0;

const $ = (id) => document.getElementById(id);
const setStatus = (msg, isError) => {
  $("status").textContent = msg;
  $("status").classList.toggle("error", !!isError);
};

// ---------- Arrival time ----------
function setNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  $("when").value = d.toISOString().slice(0, 16);
}
const arrival = () => ($("when").value ? new Date($("when").value) : new Date());

// ---------- Parse OSM tags ----------
function feeOf(t, prefix = "") {
  const v = t[prefix + "fee"];
  if (v === "no") return "free";
  if (v && v !== "unknown") return "paid";
  return "unknown";
}

function parseCarPark(el) {
  const t = el.tags || {};
  const p = pos(el);
  if (!p) return null;
  const type = TYPE_LABEL[t.parking] || "Car park";
  const details = [];
  if (t.capacity) details.push(t.capacity + " spaces");
  if (t.maxstay) details.push("max " + t.maxstay);
  if (t.fee && !["yes", "no"].includes(t.fee)) details.push("fee " + t.fee);
  if (t.charge) details.push(t.charge);
  if (t.opening_hours) details.push(t.opening_hours === "24/7" ? "24/7" : "open " + t.opening_hours);
  if (t["capacity:disabled"]) details.push("♿ " + t["capacity:disabled"]);
  if (t["capacity:charging"]) details.push("⚡ " + t["capacity:charging"]);
  return {
    id: el.type + "/" + el.id,
    kind: "lot",
    ...p,
    name: t.name || t.operator || type,
    type,
    fee: feeOf(t),
    restricted: PRIVATE.test(t.access || ""),
    access: t.access,
    capacity: +t.capacity || 0,
    details,
  };
}

function parseStreet(el) {
  const t = el.tags || {};
  if (!el.geometry || !el.geometry.length) return null;
  // New scheme: parking:both=lane, parking:both:fee=yes …
  // Old scheme: parking:lane:both=parallel, parking:condition:both=ticket …
  let side = null, fee = "unknown", restricted = false;
  const details = [];
  for (const s of ["both", "left", "right"]) {
    if (new RegExp(STREET_VALUES).test(t["parking:" + s] || "")) {
      side = s;
      fee = feeOf(t, `parking:${s}:`);
      restricted = PRIVATE.test(t[`parking:${s}:access`] || "") || /^(residents|loading_only|charging)$/.test(t[`parking:${s}:restriction`] || "");
      if (t[`parking:${s}:maxstay`]) details.push("max " + t[`parking:${s}:maxstay`]);
      if (t[`parking:${s}:fee:conditional`]) details.push("fee " + t[`parking:${s}:fee:conditional`]);
      if (t[`parking:${s}:zone`]) details.push("zone " + t[`parking:${s}:zone`]);
      if (t[`parking:${s}:restriction`]) details.push(t[`parking:${s}:restriction`]);
      break;
    }
    if (new RegExp(STREET_VALUES).test(t["parking:lane:" + s] || "")) {
      side = s;
      const cond = t["parking:condition:" + s] || "";
      fee = cond === "free" || cond === "disc" ? "free" : cond === "ticket" ? "paid" : "unknown";
      restricted = /^(residents|private|customers|no_parking|no_stopping|loading)$/.test(cond);
      if (cond === "disc") details.push("parking disc");
      if (t[`parking:condition:${s}:maxstay`]) details.push("max " + t[`parking:condition:${s}:maxstay`]);
      if (t[`parking:condition:${s}:time_interval`]) details.push(t[`parking:condition:${s}:time_interval`]);
      break;
    }
  }
  if (!side) return null;
  const mid = el.geometry[Math.floor(el.geometry.length / 2)];
  return {
    id: el.type + "/" + el.id,
    kind: "street",
    lat: mid.lat,
    lon: mid.lon,
    line: el.geometry.map((g) => [g.lat, g.lon]),
    name: t.name ? `${t.name} (street)` : "Street parking",
    type: "Street parking" + (side === "both" ? ", both sides" : `, ${side} side`),
    fee,
    restricted,
    capacity: 0,
    details,
  };
}

// ---------- Load (car parks first, street parking second) ----------
function boundsAround(p, metres) {
  const dLat = metres / 111320;
  const dLon = metres / (111320 * Math.cos((p.lat * Math.PI) / 180));
  return { s: p.lat - dLat, w: p.lon - dLon, n: p.lat + dLat, e: p.lon + dLon };
}
function bboxAround(p, metres) {
  const b = boundsAround(p, metres);
  return [b.s, b.w, b.n, b.e].map((n) => n.toFixed(5)).join(",");
}

async function load() {
  if (!dest) return;
  const myLoad = ++loadId;
  const bb = bboxAround(dest, +$("radius").value + 150);
  lots = [];
  streets = [];
  render();
  setStatus("Looking for car parks…");
  const started = Date.now();

  // Shared check-ins from all users, loaded alongside the map data.
  store.checkinsNear(boundsAround(dest, +$("radius").value + 150))
    .then((c) => { if (myLoad === loadId) { checkins = c; render(); } })
    .catch(() => {});

  const lotQuery = `[out:json][timeout:20];nwr["amenity"="parking"](${bb});out center tags 400;`;
  const streetQuery = `[out:json][timeout:20];way["highway"][~"${STREET_KEYS}"~"${STREET_VALUES}"](${bb});out geom tags 400;`;

  try {
    const els = await overpass(lotQuery);
    if (myLoad !== loadId) return;
    lots = els.map(parseCarPark).filter(Boolean);
    render(`Found car parks in ${((Date.now() - started) / 1000).toFixed(1)} s. Loading street parking…`);
  } catch (e) {
    if (myLoad === loadId) setStatus(e.message, true);
    return;
  }
  try {
    const els = await overpass(streetQuery);
    if (myLoad !== loadId) return;
    streets = els.map(parseStreet).filter(Boolean);
    render();
  } catch {
    if (myLoad === loadId) render("Street parking didn't load (server busy). Car parks are shown.");
  }
}

// ---------- Render ----------
let shown = [];

async function render(extraStatus) {
  spotLayer.clearLayers();
  if (!dest) return;
  const when = arrival();
  const maxDist = +$("radius").value;
  const sort = $("sort").value;
  const byspot = {};
  for (const c of checkins) (byspot[c.spot] ||= []).push(c);

  shown = [...lots, ...streets]
    .map((s) => ({ ...s, dist: distance(dest, s), chance: estimate(s, when, byspot[s.id]) }))
    .filter((s) => s.dist <= maxDist)
    .filter((s) => !$("fFree").checked || s.fee === "free")
    .filter((s) => !$("fPublic").checked || !s.restricted)
    .filter((s) => $("fStreet").checked || s.kind !== "street");

  const feeRank = { free: 0, unknown: 1, paid: 2 };
  shown.sort((a, b) =>
    sort === "free" ? feeRank[a.fee] - feeRank[b.fee] || a.dist - b.dist
    : sort === "dist" ? a.dist - b.dist
    // Best chance, but don't send people 1 km away for a tiny gain
    : b.chance.p - a.chance.p - (b.dist - a.dist) / 2000
  );

  for (const s of shown) {
    const color = FEE_COLORS[s.fee];
    const popup = () => popupHtml(s);
    s.layer =
      s.kind === "street"
        ? L.polyline(s.line, { color, weight: 6, opacity: s.restricted ? 0.4 : 0.85 }).bindPopup(popup).addTo(spotLayer)
        : L.marker([s.lat, s.lon], { icon: dotIcon(color, s.capacity > 100 ? 18 : 14), opacity: s.restricted ? 0.5 : 1 }).bindPopup(popup).addTo(spotLayer);
  }

  const free = shown.filter((s) => s.fee === "free").length;
  const whenText = when.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  setStatus(
    extraStatus ||
      (shown.length
        ? `${shown.length} options within ${fmtDist(maxDist)} · ${free} free · for ${whenText}`
        : lots.length + streets.length
        ? "Nothing matches your filters. Try a bigger radius or turn filters off."
        : "No parking mapped here yet.")
  );

  $("list").innerHTML = shown
    .map((s, i) => {
      const walk = Math.max(1, Math.round(s.dist / 80));
      return `<div class="item" data-i="${i}">
        <div class="name"><span><span class="dot" style="background:${FEE_COLORS[s.fee]}"></span>${esc(s.name)}</span>
          <span class="chance" style="color:${CHANCE_COLOR[s.chance.label]}">${s.chance.label}</span></div>
        <div class="meta">${fmtDist(s.dist)} · ~${walk} min walk · ${esc(s.type)} · ${s.fee}${s.restricted ? " · <span style='color:var(--warn)'>restricted</span>" : ""}</div>
        ${s.details.length ? `<div class="meta">${esc(s.details.join(" · "))}</div>` : ""}
        ${s.chance.reports ? `<div class="meta">${s.chance.reports} report${s.chance.reports > 1 ? "s" : ""} at this time of day</div>` : ""}
      </div>`;
    })
    .join("");
}

function popupHtml(s) {
  const walk = Math.max(1, Math.round(s.dist / 80));
  const c = s.chance;
  return (
    `<b>${esc(s.name)}</b><br>${esc(s.type)} · <span style="color:${FEE_COLORS[s.fee]}">${s.fee}</span>` +
    `<br>${fmtDist(s.dist)} from destination (~${walk} min walk)` +
    `<br>Chance of a spot: <b style="color:${CHANCE_COLOR[c.label]}">${c.label}</b> (${Math.round(c.p * 100)}%)` +
    (c.reports ? ` · ${c.reports} report${c.reports > 1 ? "s" : ""}` : " · estimate only") +
    (s.restricted ? `<br><span style="color:var(--warn)">Restricted access${s.access ? " (" + esc(s.access) + ")" : ""}</span>` : "") +
    (s.details.length ? `<br>${esc(s.details.join(" · "))}` : "") +
    `<div class="popup-actions">
      <button data-checkin="found" data-spot="${esc(s.id)}" data-lat="${s.lat}" data-lon="${s.lon}">✅ Found a spot</button>
      <button data-checkin="full" data-spot="${esc(s.id)}" data-lat="${s.lat}" data-lon="${s.lon}">⛔ It was full</button>
    </div>` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Navigate</a>` +
    ` · <a href="https://www.openstreetmap.org/${s.id}" target="_blank" rel="noopener">Map data</a>`
  );
}

// Buttons inside popups ("Found a spot" / "It was full")
document.addEventListener(
  "click",
  async (e) => {
    const b = e.target.closest("[data-checkin]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const found = b.dataset.checkin === "found";
    map.closePopup();
    try {
      await store.addCheckin(b.dataset.spot, found, +b.dataset.lat, +b.dataset.lon);
      checkins.push({ spot: b.dataset.spot, found, at: new Date().toISOString() });
      await render();
      setStatus("Thanks! Shared with everyone. It improves the estimate for this place and time.");
    } catch (err) {
      setStatus(err.message, true);
    }
  },
  true
);

$("list").addEventListener("click", (e) => {
  const item = e.target.closest(".item");
  if (!item) return;
  const s = shown[+item.dataset.i];
  map.setView([s.lat, s.lon], Math.max(map.getZoom(), 17));
  s.layer.openPopup([s.lat, s.lon]);
});

// ---------- User reports (signs, construction, full/free) ----------
function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return m <= 1 ? "just now" : m + " min ago";
  const h = Math.round(m / 60);
  return h < 48 ? h + " h ago" : Math.round(h / 24) + " days ago";
}

function readingHtml(r) {
  const x = r.sign_reading;
  if (!x) return r.type === "sign" && r.photo ? `<br><i class="muted">Sign not read by AI yet.</i>` : "";
  if (!x.is_parking_sign) return `<br><i class="muted">AI: this doesn't look like a parking sign.</i>`;
  const rules = (x.rules || [])
    .map((u) => `<li>${esc(u.when)}: ${u.parking_allowed ? "parking OK" : "no parking"}${u.max_stay_minutes ? `, max ${u.max_stay_minutes >= 60 ? u.max_stay_minutes / 60 + " h" : u.max_stay_minutes + " min"}` : ""}${u.fee !== "unknown" ? ", " + u.fee : ""}${u.requires ? ", needs " + esc(u.requires) : ""}</li>`)
    .join("");
  return `<div style="margin-top:6px"><b>AI reading</b> <span class="muted">(${esc(x.confidence)} confidence)</span><br>${esc(x.summary_en)}` +
    (rules ? `<ul style="margin:4px 0;padding-left:18px">${rules}</ul>` : "") +
    (x.street_cleaning ? `Street cleaning: ${esc(x.street_cleaning)}` : "") + `</div>`;
}

let reportTimer = null;
function scheduleReports() {
  clearTimeout(reportTimer);
  reportTimer = setTimeout(renderReports, 400);
}

async function renderReports() {
  if (!$("fReports").checked) { reportLayer.clearLayers(); return; }
  const b = map.getBounds();
  let reports;
  try {
    reports = await store.listReports({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() });
  } catch {
    return; // reports are a bonus; the map still works without them
  }
  reportLayer.clearLayers();
  for (const r of reports) {
    const t = REPORT_TYPES[r.type] || REPORT_TYPES.sign;
    L.marker([r.lat, r.lon], { icon: L.divIcon({ className: "", html: `<span style="display:grid;place-items:center;width:22px;height:22px;border-radius:5px;background:${t.color};color:#fff;font:700 13px system-ui;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)">!</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }) })
      .bindPopup(
        `<b style="color:${t.color}">${t.label}</b><br><span class="muted">${timeAgo(r.at)}</span>` +
          (r.note ? `<br>${esc(r.note)}` : "") +
          readingHtml(r) +
          (r.photo ? `<a href="${r.photo}" target="_blank" rel="noopener"><img class="popup-photo" src="${r.photo}" alt="Report photo"></a>` : ""),
        { maxWidth: 260 }
      )
      .addTo(reportLayer);
  }
}

$("reportTypes").innerHTML = Object.entries(REPORT_TYPES)
  .map(([k, t], i) => `<label><input type="radio" name="rtype" value="${k}" ${i === 0 ? "checked" : ""}/><span class="dot" style="background:${t.color}"></span>${t.label}</label>`)
  .join("");

function openReport(open) {
  $("reportView").hidden = !open;
  $("searchView").hidden = open;
  $("crosshair").hidden = !open;
  $("list").hidden = open;
  if (!open) $("reportView").reset();
}
$("reportBtn").addEventListener("click", () => openReport(true));
$("cancelReport").addEventListener("click", () => openReport(false));
$("reportView").addEventListener("submit", async (e) => {
  e.preventDefault();
  const c = map.getCenter();
  const file = $("photo").files[0];
  try {
    const type = new FormData($("reportView")).get("rtype");
    $("saveReport").disabled = true;
    $("saveReport").textContent = file ? "Uploading photo…" : "Saving…";
    const photo = file ? await shrinkPhoto(file) : null;
    const row = await store.addReport({ type, lat: c.lat, lon: c.lng, note: $("note").value.trim(), photo });
    openReport(false);
    $("fReports").checked = true;
    await renderReports();
    if (type === "sign" && photo) {
      setStatus("Report shared. Reading the sign with AI…");
      try {
        const reading = await store.readSign(row.id);
        await renderReports();
        setStatus(reading && reading.is_parking_sign ? "Sign read: " + reading.summary_en : "Report shared. The AI couldn't find a parking sign in the photo.");
      } catch (err) {
        setStatus("Report shared. " + err.message);
      }
    } else {
      setStatus("Report shared with everyone.");
    }
  } catch (err) {
    setStatus(err.message, true);
    openReport(false);
  } finally {
    $("saveReport").disabled = false;
    $("saveReport").textContent = "Save report";
  }
});

// ---------- Destination ----------
function setDest(p, label) {
  dest = p;
  if (destMarker) map.removeLayer(destMarker);
  if (radiusCircle) map.removeLayer(radiusCircle);
  destMarker = L.marker([p.lat, p.lon], { title: "Destination", zIndexOffset: 1000 }).addTo(map).bindPopup(label || "Your destination");
  radiusCircle = L.circle([p.lat, p.lon], { radius: +$("radius").value, color: "#2f6fed", weight: 1.5, fillOpacity: 0.04, dashArray: "6 6", interactive: false }).addTo(map);
  load();
}

$("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("place").value.trim();
  if (!text) return;
  setStatus("Finding the place…");
  try {
    const hit = await geocode(text);
    map.setView([hit.lat, hit.lon], 16);
    setDest(hit, esc(hit.label));
  } catch (err) {
    setStatus(err.message, true);
  }
});
$("locate").addEventListener("click", async () => {
  setStatus("Finding your location…");
  try {
    const me = await locate();
    map.setView([me.lat, me.lon], 16);
    setDest(me, "You are here");
  } catch (err) {
    setStatus(err.message, true);
  }
});
map.on("click", (e) => {
  if (!$("reportView").hidden) return; // in report mode the map just pans
  setDest({ lat: e.latlng.lat, lon: e.latlng.lng });
});
$("radius").addEventListener("change", () => dest && setDest(dest));
["fFree", "fPublic", "fStreet", "sort", "when"].forEach((id) => $(id).addEventListener("change", () => render()));
$("fReports").addEventListener("change", renderReports);
map.on("moveend", () => { if ($("reportView").hidden) scheduleReports(); });
$("now").addEventListener("click", () => { setNow(); render(); });

setNow();
renderReports();
