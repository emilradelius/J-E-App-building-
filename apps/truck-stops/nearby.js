// Truck Stop Map — v0
// Shows truck stops, rest areas, truck parking and truck fuel from OpenStreetMap,
// plus a simple break timer based on the EU 4.5 h driving rule.
const { overpass, geocode, distance, fmtDist, pos, bboxString, baseMap, locate, esc, dotIcon } = MapUtils;

const BREAK_AFTER_MIN = 4.5 * 60;
const MIN_ZOOM_FOR_SEARCH = 9;

const TYPES = {
  services: { label: "Truck stop / services", color: "#2f6fed" },
  rest_area: { label: "Rest area", color: "#1f9d55" },
  parking: { label: "Truck parking", color: "#c27c0e" },
  fuel: { label: "Truck fuel", color: "#d64545" },
};

const map = baseMap("map", [57.78, 14.16], 10); // Jönköping — E4 truck corridor
const layer = L.layerGroup().addTo(map);
let rangeCircle = null;
let me = null; // my position, if known
let meMarker = null;
let places = [];
let searchCenter = null; // distances are measured from here when location is unknown
const enabled = new Set(Object.keys(TYPES));

const $ = (id) => document.getElementById(id);
const setStatus = (msg, isError) => {
  $("status").textContent = msg;
  $("status").classList.toggle("error", !!isError);
};

// ---------- Filters ----------
$("filters").innerHTML = Object.entries(TYPES)
  .map(([k, t]) => `<label class="chip"><input type="checkbox" data-type="${k}" checked /><span class="dot" style="background:${t.color}"></span>${t.label}</label>`)
  .join("");
$("filters").addEventListener("change", (e) => {
  const k = e.target.dataset.type;
  e.target.checked ? enabled.add(k) : enabled.delete(k);
  render();
});

// ---------- Classify an OSM element ----------
function classify(tags) {
  if (tags.highway === "services") return "services";
  if (tags.highway === "rest_area") return "rest_area";
  if (tags.amenity === "fuel") return "fuel";
  return "parking";
}

function features(t) {
  const f = [];
  if (t["capacity:hgv"]) f.push(t["capacity:hgv"] + " truck spaces");
  else if (t.capacity) f.push(t.capacity + " spaces");
  if (t.toilets === "yes") f.push("toilets");
  if (t.shower === "yes" || t.showers === "yes") f.push("showers");
  if (t.restaurant === "yes" || t.food === "yes") f.push("food");
  if (t.fee === "yes") f.push("paid");
  if (t.fee === "no") f.push("free");
  if (t.supervised === "yes" || t.surveillance) f.push("guarded/CCTV");
  if (t.opening_hours) f.push(t.opening_hours === "24/7" ? "24/7" : "open " + t.opening_hours);
  return f;
}

// ---------- Search ----------
async function findStops() {
  if (map.getZoom() < MIN_ZOOM_FOR_SEARCH) {
    setStatus("Zoom in a bit more first (the area is too big).", true);
    return;
  }
  const bb = bboxString(map);
  searchCenter = { lat: map.getCenter().lat, lon: map.getCenter().lng };
  const q = `[out:json][timeout:25];
(
  nwr["highway"~"^(services|rest_area)$"](${bb});
  nwr["amenity"="parking"]["hgv"~"^(yes|designated)$"](${bb});
  nwr["amenity"="fuel"]["hgv"~"^(yes|designated)$"](${bb});
  nwr["amenity"="fuel"]["fuel:HGV_diesel"="yes"](${bb});
);
out center tags 400;`;
  $("find").disabled = true;
  setStatus("Loading truck stops…");
  try {
    const els = await overpass(q);
    places = els
      .map((el) => {
        const p = pos(el);
        if (!p) return null;
        const t = el.tags || {};
        const type = classify(t);
        return {
          id: el.type + "/" + el.id,
          type,
          ...p,
          name: t.name || t.brand || t.operator || TYPES[type].label,
          features: features(t),
          tags: t,
        };
      })
      .filter(Boolean);
    drawRange();
    setStatus(places.length ? `${places.length} places found.` : "Nothing found here. Try another area.");
    render();
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    $("find").disabled = false;
  }
}

// ---------- Break planner ----------
function minutesSince(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  if (start > now) start.setDate(start.getDate() - 1); // started yesterday evening
  return Math.round((now - start) / 60000);
}
const fmtMin = (m) => `${Math.floor(m / 60)} h ${String(Math.abs(m % 60)).padStart(2, "0")} min`;

function rangeKm() {
  const left = BREAK_AFTER_MIN - minutesSince($("since").value);
  return Math.max(0, (left / 60) * (+$("speed").value || 75));
}

function updateBreak() {
  const driven = minutesSince($("since").value);
  const left = BREAK_AFTER_MIN - driven;
  const due = new Date(Date.now() + left * 60000);
  const at = due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  $("breakInfo").innerHTML =
    left > 0
      ? `Driven <b>${fmtMin(driven)}</b>. Break due at <b>${at}</b> (in ${fmtMin(left)}) — about <b>${Math.round(rangeKm())} km</b> more.`
      : `<span style="color:var(--bad)"><b>Break is due now</b> — you've driven ${fmtMin(driven)}.</span>`;
  drawRange();
  render();
}

function drawRange() {
  if (rangeCircle) map.removeLayer(rangeCircle);
  rangeCircle = null;
  if (!$("showRange").checked) return;
  const c = me || searchCenter || { lat: map.getCenter().lat, lon: map.getCenter().lng };
  // Straight-line circle; road distance is longer, so this is an optimistic upper bound.
  rangeCircle = L.circle([c.lat, c.lon], {
    radius: rangeKm() * 1000,
    color: "#2f6fed",
    weight: 1.5,
    fillOpacity: 0.05,
    dashArray: "6 6",
    interactive: false,
  }).addTo(map);
}

// ---------- Render list + markers ----------
function render() {
  layer.clearLayers();
  const ref = me || searchCenter || { lat: map.getCenter().lat, lon: map.getCenter().lng };
  const range = rangeKm() * 1000;
  const shown = places
    .filter((p) => enabled.has(p.type))
    .map((p) => ({ ...p, dist: distance(ref, p) }))
    .sort((a, b) => a.dist - b.dist);

  for (const p of shown) {
    const t = TYPES[p.type];
    p.marker = L.marker([p.lat, p.lon], { icon: dotIcon(t.color) })
      .bindPopup(
        `<b>${esc(p.name)}</b><br><span style="color:${t.color}">${t.label}</span> · ${fmtDist(p.dist)} away` +
          (p.features.length ? `<br>${esc(p.features.join(" · "))}` : "") +
          `<br><a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}" target="_blank" rel="noopener">Navigate</a>` +
          ` · <a href="https://www.openstreetmap.org/${p.id}" target="_blank" rel="noopener">Details</a>`
      )
      .addTo(layer);
  }

  $("list").innerHTML = shown.length
    ? shown
        .map((p, i) => {
          const t = TYPES[p.type];
          const inRange = $("showRange").checked && p.dist <= range;
          return `<div class="item" data-i="${i}">
            <div class="name"><span class="dot" style="background:${t.color}"></span>${esc(p.name)}</div>
            <div class="meta">${t.label} · ${fmtDist(p.dist)}${inRange ? ' · <span style="color:var(--ok)">reachable before break</span>' : ""}</div>
            ${p.features.length ? `<div class="meta">${esc(p.features.join(" · "))}</div>` : ""}
          </div>`;
        })
        .join("")
    : "";
  $("list").onclick = (e) => {
    const item = e.target.closest(".item");
    if (!item) return;
    const p = shown[+item.dataset.i];
    map.setView([p.lat, p.lon], Math.max(map.getZoom(), 13));
    p.marker.openPopup();
  };
}

// ---------- Wire up ----------
$("find").addEventListener("click", findStops);
$("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("place").value.trim();
  if (!text) return;
  setStatus("Searching…");
  try {
    const hit = await geocode(text);
    map.setView([hit.lat, hit.lon], 11);
    setStatus(hit.label);
    findStops();
  } catch (err) {
    setStatus(err.message, true);
  }
});
$("locate").addEventListener("click", async () => {
  setStatus("Finding your location…");
  try {
    me = await locate();
    if (meMarker) map.removeLayer(meMarker);
    meMarker = L.marker([me.lat, me.lon], { icon: dotIcon("#111", 16), title: "You" }).addTo(map).bindPopup("You are here");
    map.setView([me.lat, me.lon], 11);
    updateBreak();
    findStops();
  } catch (err) {
    setStatus(err.message, true);
  }
});
["since", "speed", "showRange"].forEach((id) => $(id).addEventListener("input", updateBreak));
map.on("moveend", () => { if (!me && !searchCenter) drawRange(); });

// Default: started driving 2 hours ago (just so the planner shows something)
const start = new Date(Date.now() - 2 * 3600 * 1000);
$("since").value = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
updateBreak();
setInterval(updateBreak, 60000);
