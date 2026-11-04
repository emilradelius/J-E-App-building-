// Park for Free (Car Parking Finder v2)
// 1. "Can I park here?" or pick a destination → car parks + street parking from OpenStreetMap.
// 2. Rules (rules.js): free / free for a while / paid / not allowed, for YOUR arrival time
//    and how long you stay. Sign photos read by AI override map data.
// 3. Chance of a space (model.js): area activity + number of spaces + people's check-ins.
//    Plus the chance of finding free parking somewhere within walking distance, by hour.
const { overpass, geocode, distance, fmtDist, pos, baseMap, locate, esc, dotIcon } = MapUtils;
const { estimate, combine, areaProfile, activityQuery, parseActivity, COLOR: CHANCE_COLOR } = ParkingModel;
const { TYPES: REPORT_TYPES, store, shrinkPhoto } = Reports;
const { VERDICT, fmtTime } = Rules;

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
const STREET_KEYS = "^parking:(lane:)?(both|left|right)$";
const STREET_VALUES = "^(lane|street_side|on_kerb|half_on_kerb|shoulder|yes|parallel|diagonal|perpendicular|marked|no|no_parking|no_stopping)$";
const PARKING_OK = /^(lane|street_side|on_kerb|half_on_kerb|shoulder|yes|parallel|diagonal|perpendicular|marked)$/;
const SIGN_MATCH_M = { street: 25, lot: 40 }; // a sign photo this close applies to the spot
const HERE_M = 35; // "Can I park here?" looks this far

const map = baseMap("map", [55.605, 13.0007], 15); // Malmö centre
const spotLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
let dest = null, destMarker = null, radiusCircle = null, destLabel = "";
let lots = [], streets = [], checkins = [], signs = [], area = areaProfile(null), areaLoaded = false;
let loadId = 0;

const $ = (id) => document.getElementById(id);
const setStatus = (msg, isError) => {
  $("status").textContent = msg;
  $("status").classList.toggle("error", !!isError);
};

// ---------- Arrival time + stay ----------
function toLocalInput(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}
const setNow = () => ($("when").value = toLocalInput(new Date()));
const arrival = () => ($("when").value ? new Date($("when").value) : new Date());
const stay = () => +$("stay").value;

// ---------- Geometry ----------
function metresXY(origin, p) {
  const k = 111320;
  return [(p.lon - origin.lon) * k * Math.cos((origin.lat * Math.PI) / 180), (p.lat - origin.lat) * k];
}
function lineDistance(p, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = metresXY(p, { lat: line[i][0], lon: line[i][1] });
    const [bx, by] = metresXY(p, { lat: line[i + 1][0], lon: line[i + 1][1] });
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return line.length === 1 ? distance(p, { lat: line[0][0], lon: line[0][1] }) : best;
}
const spotDistance = (s, p) => (s.line ? lineDistance(p, s.line) : distance(s, p));
function lineLength(line) {
  let m = 0;
  for (let i = 0; i < line.length - 1; i++) m += distance({ lat: line[i][0], lon: line[i][1] }, { lat: line[i + 1][0], lon: line[i + 1][1] });
  return m;
}

// ---------- Parse OSM ----------
function parseCarPark(el) {
  const t = el.tags || {};
  const p = pos(el);
  if (!p) return null;
  const type = TYPE_LABEL[t.parking] || "Car park";
  const details = [];
  if (t.capacity) details.push(t.capacity + " spaces");
  if (t.opening_hours) details.push(t.opening_hours === "24/7" ? "24/7" : "open " + t.opening_hours);
  if (t["capacity:disabled"]) details.push("♿ " + t["capacity:disabled"]);
  if (t["capacity:charging"]) details.push("⚡ " + t["capacity:charging"]);
  if (t.operator) details.push(t.operator);
  return {
    id: el.type + "/" + el.id,
    kind: "lot",
    ...p,
    name: t.name || type,
    type,
    capacity: +t.capacity || 0,
    details,
    osmRules: Rules.lotRules(t),
  };
}

function parseStreet(el) {
  const t = el.tags || {};
  if (!el.geometry || el.geometry.length < 2) return null;
  const val = (s) => t["parking:" + s] || t["parking:lane:" + s];
  let side = null, sides = 0;
  if (val("both")) { side = "both"; sides = PARKING_OK.test(val("both")) ? 2 : 0; }
  else {
    const ok = ["left", "right"].filter((s) => PARKING_OK.test(val(s) || ""));
    sides = ok.length;
    side = ok[0] || ["left", "right"].find((s) => val(s));
  }
  if (!side || val(side) === "separate") return null;
  const line = el.geometry.map((g) => [g.lat, g.lon]);
  const mid = el.geometry[Math.floor(el.geometry.length / 2)];
  const details = [];
  const mx = t[`parking:${side}:maxstay`] || t[`parking:condition:${side}:maxstay`];
  if (mx) details.push("max " + mx);
  return {
    id: el.type + "/" + el.id,
    kind: "street",
    lat: mid.lat,
    lon: mid.lon,
    line,
    length: lineLength(line),
    sides: Math.max(1, sides),
    name: t.name || "Street parking",
    type: sides === 0 ? "No street parking" : "Street parking" + (side === "both" ? ", both sides" : `, ${side} side`),
    capacity: 0,
    details,
    osmRules: Rules.streetRules(t, side),
  };
}

// ---------- Sign photos → rules ----------
function attachSigns(spots) {
  for (const s of spots) {
    let best = null;
    for (const r of signs) {
      const d = spotDistance(s, r);
      if (d <= SIGN_MATCH_M[s.kind] && (!best || new Date(r.at) > new Date(best.at))) best = r;
    }
    s.sign = best;
    s.rules = best ? Rules.fromSign(best.sign_reading, best.at) : s.osmRules;
  }
}

// ---------- Load ----------
function boundsAround(p, metres) {
  const dLat = metres / 111320;
  const dLon = metres / (111320 * Math.cos((p.lat * Math.PI) / 180));
  return { s: p.lat - dLat, w: p.lon - dLon, n: p.lat + dLat, e: p.lon + dLon };
}
function bboxAround(p, metres) {
  const b = boundsAround(p, metres);
  return [b.s, b.w, b.n, b.e].map((n) => n.toFixed(5)).join(",");
}

async function loadShared(myLoad, b) {
  const [c, reps] = await Promise.all([
    store.checkinsNear(b).catch(() => []),
    store.listReports(b).catch(() => []),
  ]);
  if (myLoad !== loadId) return;
  signs = reps.filter((r) => r.type === "sign" && r.sign_reading && r.sign_reading.is_parking_sign);
  // "Full right now" / "Free spots right now" reports count as check-ins nearby
  const live = reps.filter((r) => r.type === "full" || r.type === "free").map((r) => ({ spot: null, found: r.type === "free", lat: r.lat, lon: r.lon, at: r.at }));
  checkins = [...c, ...live];
  attachSigns([...lots, ...streets]);
}

async function load() {
  if (!dest) return;
  const myLoad = ++loadId;
  const r = +$("radius").value + 150;
  const bb = bboxAround(dest, r);
  lots = [];
  streets = [];
  areaLoaded = false;
  render();
  setStatus("Looking for parking…");
  const started = Date.now();
  const shared = loadShared(myLoad, boundsAround(dest, r));

  const lotQuery = `[out:json][timeout:20];nwr["amenity"="parking"](${bb});out center tags 400;`;
  const streetQuery = `[out:json][timeout:20];way["highway"][~"${STREET_KEYS}"~"${STREET_VALUES}"](${bb});out geom tags 500;`;

  try {
    const els = await overpass(lotQuery);
    if (myLoad !== loadId) return;
    lots = els.map(parseCarPark).filter(Boolean);
    await shared;
    attachSigns(lots);
    render(`Found car parks in ${((Date.now() - started) / 1000).toFixed(1)} s. Loading street parking…`);
  } catch (e) {
    if (myLoad === loadId) setStatus(e.message, true);
    return;
  }
  const activity = overpass(activityQuery(dest)).then((els) => {
    if (myLoad !== loadId) return;
    area = areaProfile(parseActivity(els));
    areaLoaded = true;
  }).catch(() => {});
  try {
    const els = await overpass(streetQuery);
    if (myLoad !== loadId) return;
    streets = els.map(parseStreet).filter(Boolean);
    attachSigns(streets);
  } catch {
    if (myLoad === loadId) setStatus("Street parking didn't load (server busy). Car parks are shown.");
  }
  await activity;
  if (myLoad === loadId) render();
}

// ---------- Evaluate ----------
const GROUP = { free: 0, limited: 0, unknown: 1, paid: 2, no: 3 };

function evaluateAll(when, minutes, list = [...lots, ...streets]) {
  return list.map((s) => {
    const v = Rules.evaluate(s.rules || s.osmRules, when, minutes);
    const chance = estimate(s, when, { area, checkins, paidNow: v.paidNow, distanceFn: spotDistance });
    return { ...s, v, chance, dist: dest ? spotDistance(s, dest) : 0 };
  });
}

// Chance of free parking within `metres` of the destination at time `when`
function areaChance(evaluated, metres) {
  const ok = evaluated.filter((s) => s.dist <= metres && (s.v.verdict === "free" || s.v.verdict === "limited"));
  return { p: ok.length ? combine(ok.map((s) => s.chance.p)) : 0, n: ok.length };
}

// ---------- Render ----------
let shown = [], lastAll = [];
const pct = (p) => Math.round(p * 100) + "%";
const chanceColor = (p) => (p >= 0.6 ? "var(--ok)" : p >= 0.35 ? "var(--warn)" : "var(--bad)");

function render(extraStatus) {
  spotLayer.clearLayers();
  renderLegend();
  if (!dest) { $("area").hidden = true; $("answer").hidden = true; return; }
  const when = arrival();
  const minutes = stay();
  const maxDist = +$("radius").value;
  const all = evaluateAll(when, minutes).filter((s) => s.dist <= maxDist + 40);
  lastAll = all;

  shown = all
    .filter((s) => s.dist <= maxDist)
    .filter((s) => $("fPaid").checked || s.v.verdict !== "paid")
    .filter((s) => $("fNo").checked || s.v.verdict !== "no")
    .filter((s) => $("fStreet").checked || s.kind !== "street");

  shown.sort((a, b) =>
    $("sort").value === "dist" ? a.dist - b.dist
    : GROUP[a.v.verdict] - GROUP[b.v.verdict] || b.chance.p - a.chance.p - (b.dist - a.dist) / 2000
  );

  for (const s of shown) {
    const color = VERDICT[s.v.verdict].color;
    const popup = () => popupHtml(s);
    s.layer =
      s.kind === "street"
        ? L.polyline(s.line, { color, weight: s.v.verdict === "no" ? 3 : 6, opacity: 0.85, dashArray: s.v.verdict === "unknown" ? "6 6" : null }).bindPopup(popup, { maxWidth: 280 }).addTo(spotLayer)
        : L.marker([s.lat, s.lon], { icon: dotIcon(color, s.capacity > 100 ? 18 : 14) }).bindPopup(popup, { maxWidth: 280 }).addTo(spotLayer);
  }

  renderAnswer(all);
  renderArea(all, when, minutes, maxDist);

  const free = shown.filter((s) => s.v.verdict === "free").length;
  const whenText = when.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  setStatus(
    extraStatus ||
      (shown.length
        ? `${shown.length} options within ${fmtDist(maxDist)} · ${free} free for your whole stay · ${whenText}`
        : lots.length + streets.length
        ? "Nothing matches. Try a bigger radius, or turn on “Show paid too”."
        : "No parking mapped here yet. Add a sign photo to help!")
  );

  $("list").innerHTML = shown
    .map((s, i) => {
      const walk = Math.max(1, Math.round(s.dist / 80));
      const V = VERDICT[s.v.verdict];
      return `<div class="item" data-i="${i}">
        <div class="name"><span><span class="dot" style="background:${V.color}"></span>${esc(s.name)}</span>
          <span class="badges"><span class="chance" style="color:${chanceColor(s.chance.p)}" title="Chance of a space">${pct(s.chance.p)}</span></span></div>
        <div class="meta"><b style="color:${V.color}">${esc(s.v.title)}</b></div>
        <div class="meta">${fmtDist(s.dist)} · ~${walk} min walk · ${esc(s.type)}${s.sign ? " · 📷 sign" : ""}</div>
        ${s.chance.reports ? `<div class="meta">${s.chance.reports} check-in${s.chance.reports > 1 ? "s" : ""} here</div>` : ""}
      </div>`;
    })
    .join("");
}

function renderLegend() {
  $("legend").innerHTML = Object.entries(VERDICT)
    .map(([, v]) => `<span><span class="dot" style="background:${v.color}"></span>${v.label}</span>`)
    .join("");
}

function sourceText(s) {
  if (s.sign) return `From a sign photo (${timeAgo(s.sign.at)})`;
  if (s.v.verdict === "unknown") return "No rules known here yet";
  return "From OpenStreetMap. Check the sign to be sure";
}

function chanceExplain(s) {
  const c = s.chance;
  return `~${c.spaces} space${c.spaces > 1 ? "s" : ""}, usually ~${pct(c.occupancy)} full then` +
    (c.reports ? ` · ${c.reports} check-in${c.reports > 1 ? "s" : ""}` : " · estimate");
}

// "Can I park here?": the spot right at the destination
function renderAnswer(all) {
  const box = $("answer");
  const near = all.map((s) => ({ s, d: s.dist })).filter((x) => x.d <= HERE_M).sort((a, b) => a.d - b.d);
  // Prefer an exact street over a car park entrance a bit further away
  const here = near[0]?.s;
  const freeAlt = all
    .filter((s) => s !== here && (s.v.verdict === "free" || s.v.verdict === "limited"))
    .sort((a, b) => a.dist - b.dist)[0];
  const alt = freeAlt && (!here || here.v.verdict !== "free")
    ? `<div class="small">Nearest free: <a href="#" data-goto="${esc(freeAlt.id)}">${esc(freeAlt.name)}</a>, ${fmtDist(freeAlt.dist)} · ${esc(freeAlt.v.short)} · ${pct(freeAlt.chance.p)} chance</div>`
    : "";
  const photo = `<button type="button" data-photo-here>📷 Photograph the sign</button>`;
  if (!here) {
    box.style.borderLeftColor = VERDICT.unknown.color;
    box.innerHTML = `<div class="headline">${esc(destLabel || "This spot")}: no info yet</div>
      <div class="small muted">We don't know the rules right here. If there's a sign, take a photo and the app will learn it for everyone.</div>
      ${alt}<div class="row">${photo}</div>`;
  } else {
    const V = VERDICT[here.v.verdict];
    const answer = { free: "Yes, free!", limited: "Yes, for a while", paid: "Paid here", no: "No", unknown: "Not sure" }[here.v.verdict];
    box.style.borderLeftColor = V.color;
    box.innerHTML = `<div class="headline" style="color:${V.color}">${answer}</div>
      <div><b>${esc(here.name)}</b>: ${esc(here.v.title)}</div>
      ${here.v.notes.length ? `<div class="small">${esc(here.v.notes.join(" · "))}</div>` : ""}
      <div class="small muted">${sourceText(here)}</div>
      ${here.v.verdict !== "no" ? `<div class="small">Chance of a space: <b style="color:${chanceColor(here.chance.p)}">${pct(here.chance.p)}</b> <span class="muted">(${chanceExplain(here)})</span></div>` : ""}
      ${alt}<div class="row">${here.sign ? "" : photo}</div>`;
  }
  box.hidden = false;
}

function renderArea(all, when, minutes, maxDist) {
  const box = $("area");
  if (!all.length) { box.hidden = true; return; }
  const bands = [250, 500, maxDist].filter((m, i, a) => m <= maxDist && a.indexOf(m) === i);
  const main = areaChance(all, maxDist);
  const unknown = all.filter((s) => s.dist <= maxDist && s.v.verdict === "unknown").length;

  // Best time: same day, every hour 6–23
  const day = new Date(when);
  const hours = [];
  for (let h = 6; h < 24; h++) {
    const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0);
    hours.push({ h, p: areaChance(evaluateAll(t, minutes, all), maxDist).p });
  }
  const best = hours.reduce((a, b) => (b.p > a.p ? b : a), hours[0]);

  box.innerHTML = `<div class="headline">Chance of <b>free</b> parking within ${fmtDist(maxDist)}:
      <span class="big" style="color:${chanceColor(main.p)}">${pct(main.p)}</span></div>
    <div class="bands">${bands.map((m) => `<span>${fmtDist(m)}: <b>${pct(areaChance(all, m).p)}</b></span>`).join("")}
      <span>${main.n} free option${main.n === 1 ? "" : "s"}${unknown ? ` · ${unknown} not sure` : ""}</span></div>
    <div class="small muted">Area: mostly ${esc(area.label)}${areaLoaded ? "" : " (loading…)"} · best time ${String(best.h).padStart(2, "0")}:00 (${pct(best.p)})</div>
    <div class="bars" title="Chance of free parking by arrival hour (tap to pick)">
      ${hours.map((x) => `<button type="button" data-hour="${x.h}" class="${x.h === when.getHours() ? "now" : ""}" style="height:${Math.max(6, x.p * 100)}%;background:${chanceColor(x.p)}" aria-label="${x.h}:00, ${pct(x.p)}" title="${x.h}:00 · ${pct(x.p)}"></button>`).join("")}
    </div>
    <div class="bar-labels"><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span></div>`;
  box.hidden = false;
}

function popupHtml(s) {
  const walk = Math.max(1, Math.round(s.dist / 80));
  const V = VERDICT[s.v.verdict];
  const c = s.chance;
  return (
    `<b>${esc(s.name)}</b><br>${esc(s.type)}` +
    `<br><b style="color:${V.color}">${esc(s.v.title)}</b>` +
    (s.v.notes.length ? `<br>${esc(s.v.notes.join(" · "))}` : "") +
    `<br><span class="muted small">${sourceText(s)}</span>` +
    `<br>${fmtDist(s.dist)} from destination (~${walk} min walk)` +
    (s.v.verdict !== "no" ? `<br>Chance of a space: <b style="color:${chanceColor(c.p)}">${pct(c.p)}</b><br><span class="muted small">${chanceExplain(s)}</span>` : "") +
    (s.details.length ? `<br>${esc(s.details.join(" · "))}` : "") +
    (s.sign ? readingHtml(s.sign) : "") +
    `<div class="popup-actions">
      <button data-checkin="found" data-spot="${esc(s.id)}" data-lat="${s.lat}" data-lon="${s.lon}">✅ Found a spot</button>
      <button data-checkin="full" data-spot="${esc(s.id)}" data-lat="${s.lat}" data-lon="${s.lon}">⛔ It was full</button>
      <button data-photo-at="${s.lat},${s.lon}">📷 Sign</button>
    </div>` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Navigate</a>` +
    ` · <a href="https://www.openstreetmap.org/${s.id}" target="_blank" rel="noopener">Map data</a>`
  );
}

// ---------- Clicks ----------
document.addEventListener(
  "click",
  async (e) => {
    const b = e.target.closest("[data-checkin],[data-photo-at],[data-photo-here],[data-goto],[data-hour]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.hour) {
      const t = arrival();
      t.setHours(+b.dataset.hour, 0, 0, 0);
      $("when").value = toLocalInput(t);
      return render();
    }
    if (b.dataset.goto) {
      const s = shown.find((x) => x.id === b.dataset.goto) || lastAll.find((x) => x.id === b.dataset.goto);
      if (s) { map.setView([s.lat, s.lon], Math.max(map.getZoom(), 17)); if (s.layer) s.layer.openPopup([s.lat, s.lon]); }
      return;
    }
    if (b.hasAttribute("data-photo-here") || b.dataset.photoAt) {
      const [lat, lon] = b.dataset.photoAt ? b.dataset.photoAt.split(",").map(Number) : [dest.lat, dest.lon];
      map.closePopup();
      map.setView([lat, lon], Math.max(map.getZoom(), 18));
      openReport(true, "sign");
      return;
    }
    const found = b.dataset.checkin === "found";
    map.closePopup();
    try {
      await store.addCheckin(b.dataset.spot, found, +b.dataset.lat, +b.dataset.lon);
      checkins.push({ spot: b.dataset.spot, found, lat: +b.dataset.lat, lon: +b.dataset.lon, at: new Date().toISOString() });
      render();
      setStatus("Thanks! Shared with everyone. It improves the chance for this place and time.");
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
    .map((u) => `<li>${esc(u.hours || u.when)}: ${u.parking_allowed ? "parking OK" : "no parking"}${u.max_stay_minutes ? `, max ${Rules.fmtMin(u.max_stay_minutes)}` : ""}${u.fee !== "unknown" ? ", " + u.fee : ""}${u.requires ? ", needs " + esc(u.requires) : ""}</li>`)
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

function openReport(open, type) {
  $("reportView").hidden = !open;
  $("searchView").hidden = open;
  $("crosshair").hidden = !open;
  $("list").hidden = open;
  if (!open) $("reportView").reset();
  if (open && type) $("reportView").querySelector(`input[value="${type}"]`).checked = true;
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
        if (reading && reading.is_parking_sign && dest) {
          await loadShared(loadId, boundsAround(dest, +$("radius").value + 150));
          render();
        }
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
  destLabel = label || "";
  if (destMarker) map.removeLayer(destMarker);
  if (radiusCircle) map.removeLayer(radiusCircle);
  destMarker = L.marker([p.lat, p.lon], { title: "Destination", zIndexOffset: 1000 }).addTo(map).bindPopup(esc(label || "Your destination"));
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
    setDest(hit, hit.label.split(",")[0]);
  } catch (err) {
    setStatus(err.message, true);
  }
});
$("hereBtn").addEventListener("click", async () => {
  setStatus("Finding your location…");
  try {
    const me = await locate();
    setNow();
    map.setView([me.lat, me.lon], 18);
    setDest(me, "Here");
  } catch (err) {
    setStatus(err.message, true);
  }
});
map.on("click", (e) => {
  if (!$("reportView").hidden) return; // in report mode the map just pans
  setDest({ lat: e.latlng.lat, lon: e.latlng.lng }, "This spot");
});
$("radius").addEventListener("change", () => dest && setDest(dest, destLabel));
["fPaid", "fNo", "fStreet", "sort", "when", "stay"].forEach((id) => $(id).addEventListener("change", () => render()));
$("fReports").addEventListener("change", renderReports);
map.on("moveend", () => { if ($("reportView").hidden) scheduleReports(); });
$("now").addEventListener("click", () => { setNow(); render(); });

setNow();
renderLegend();
renderReports();
