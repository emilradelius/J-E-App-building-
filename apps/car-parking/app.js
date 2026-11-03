// Car Parking Finder — v0
// Pick a destination, see car parks and street parking around it from OpenStreetMap,
// coloured free / paid / unknown and sorted by walking distance.
const { overpass, geocode, distance, fmtDist, pos, baseMap, locate, esc, dotIcon } = MapUtils;

const COLORS = { free: "#1f9d55", paid: "#d64545", unknown: "#8a94a6" };
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
const PRIVATE = /^(private|customers|permit|no|delivery|residents)$/;
const STREET_VALUES = "^(lane|street_side|on_kerb|half_on_kerb|shoulder|yes)$";

const map = baseMap("map", [59.3326, 18.0649], 15); // Stockholm city
const layer = L.layerGroup().addTo(map);
let dest = null, destMarker = null, radiusCircle = null;
let spots = [];

const $ = (id) => document.getElementById(id);
const setStatus = (msg, isError) => {
  $("status").textContent = msg;
  $("status").classList.toggle("error", !!isError);
};

// ---------- Parse OSM tags ----------
function feeOf(t, prefix = "") {
  const v = t[prefix + "fee"];
  if (v === "no") return "free";
  if (v && v !== "unknown") return "paid"; // "yes" or e.g. "Mo-Fr 08:00-18:00"
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
  // Street parking can be tagged per side: parking:both / parking:left / parking:right
  const sides = ["both", "left", "right"].filter((s) => new RegExp(STREET_VALUES).test(t["parking:" + s] || ""));
  if (!sides.length) return null;
  const s = sides[0];
  const fee = feeOf(t, `parking:${s}:`);
  const restricted = PRIVATE.test(t[`parking:${s}:access`] || "") || /^(residents|disc)$/.test(t[`parking:${s}:restriction`] || "");
  const details = [];
  if (t[`parking:${s}:maxstay`]) details.push("max " + t[`parking:${s}:maxstay`]);
  if (t[`parking:${s}:fee:conditional`]) details.push("fee " + t[`parking:${s}:fee:conditional`]);
  if (t[`parking:${s}:zone`]) details.push("zone " + t[`parking:${s}:zone`]);
  if (t[`parking:${s}:restriction`]) details.push(t[`parking:${s}:restriction`]);
  const mid = el.geometry[Math.floor(el.geometry.length / 2)];
  return {
    id: el.type + "/" + el.id,
    kind: "street",
    lat: mid.lat,
    lon: mid.lon,
    line: el.geometry.map((g) => [g.lat, g.lon]),
    name: t.name ? `${t.name} (street)` : "Street parking",
    type: "Street parking" + (s === "both" ? ", both sides" : `, ${s} side`),
    fee,
    restricted,
    capacity: 0,
    details,
  };
}

// ---------- Load ----------
async function load() {
  if (!dest) return;
  const r = +$("radius").value + 200; // fetch a little extra around the walking radius
  const around = `around:${r},${dest.lat},${dest.lon}`;
  const q = `[out:json][timeout:25];
nwr["amenity"="parking"](${around});
out center tags 500;
(
  way["highway"]["parking:both"~"${STREET_VALUES}"](${around});
  way["highway"]["parking:left"~"${STREET_VALUES}"](${around});
  way["highway"]["parking:right"~"${STREET_VALUES}"](${around});
);
out geom tags 500;`;
  setStatus("Looking for parking…");
  try {
    const els = await overpass(q);
    spots = els.map((el) => (el.tags && el.tags.amenity === "parking" ? parseCarPark(el) : parseStreet(el))).filter(Boolean);
    render();
  } catch (e) {
    setStatus(e.message, true);
  }
}

// ---------- Render ----------
function render() {
  layer.clearLayers();
  if (!dest) return;
  const maxDist = +$("radius").value;
  const sort = $("sort").value;
  let shown = spots
    .map((s) => ({ ...s, dist: distance(dest, s) }))
    .filter((s) => s.dist <= maxDist)
    .filter((s) => !$("fFree").checked || s.fee === "free")
    .filter((s) => !$("fPublic").checked || !s.restricted)
    .filter((s) => $("fStreet").checked || s.kind !== "street");

  const feeRank = { free: 0, unknown: 1, paid: 2 };
  shown.sort((a, b) =>
    sort === "free" ? feeRank[a.fee] - feeRank[b.fee] || a.dist - b.dist
    : sort === "size" ? b.capacity - a.capacity || a.dist - b.dist
    : a.dist - b.dist
  );

  for (const s of shown) {
    const color = COLORS[s.fee];
    const walk = Math.max(1, Math.round(s.dist / 80)); // ~80 m per minute walking
    const popup =
      `<b>${esc(s.name)}</b><br>${esc(s.type)} · <span style="color:${color}">${s.fee}</span>` +
      `<br>${fmtDist(s.dist)} from destination (~${walk} min walk)` +
      (s.restricted ? `<br><span style="color:var(--warn)">Restricted access${s.access ? " (" + esc(s.access) + ")" : ""}</span>` : "") +
      (s.details.length ? `<br>${esc(s.details.join(" · "))}` : "") +
      `<br><a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Navigate</a>` +
      ` · <a href="https://www.openstreetmap.org/${s.id}" target="_blank" rel="noopener">Details</a>`;
    s.layer =
      s.kind === "street"
        ? L.polyline(s.line, { color, weight: 6, opacity: s.restricted ? 0.4 : 0.85 }).bindPopup(popup).addTo(layer)
        : L.marker([s.lat, s.lon], { icon: dotIcon(color, s.capacity > 100 ? 18 : 14), opacity: s.restricted ? 0.5 : 1 }).bindPopup(popup).addTo(layer);
    s.walk = walk;
  }

  const free = shown.filter((s) => s.fee === "free").length;
  setStatus(shown.length ? `${shown.length} parking options within ${fmtDist(maxDist)} · ${free} free` : "No parking found nearby. Try a bigger radius or turn off filters.");

  $("list").innerHTML = shown
    .map(
      (s, i) => `<div class="item" data-i="${i}">
        <div class="name"><span class="dot" style="background:${COLORS[s.fee]}"></span>${esc(s.name)}</div>
        <div class="meta">${fmtDist(s.dist)} · ~${s.walk} min walk · ${esc(s.type)}${s.restricted ? " · <span style='color:var(--warn)'>restricted</span>" : ""}</div>
        ${s.details.length ? `<div class="meta">${esc(s.details.join(" · "))}</div>` : ""}
      </div>`
    )
    .join("");
  $("list").onclick = (e) => {
    const item = e.target.closest(".item");
    if (!item) return;
    const s = shown[+item.dataset.i];
    map.setView([s.lat, s.lon], Math.max(map.getZoom(), 17));
    s.layer.openPopup([s.lat, s.lon]);
  };
}

function setDest(p, label) {
  dest = p;
  if (destMarker) map.removeLayer(destMarker);
  if (radiusCircle) map.removeLayer(radiusCircle);
  destMarker = L.marker([p.lat, p.lon], { title: "Destination", zIndexOffset: 1000 }).addTo(map).bindPopup(label || "Your destination");
  radiusCircle = L.circle([p.lat, p.lon], { radius: +$("radius").value, color: "#2f6fed", weight: 1.5, fillOpacity: 0.04, dashArray: "6 6", interactive: false }).addTo(map);
  load();
}

// ---------- Wire up ----------
$("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("place").value.trim();
  if (!text) return;
  setStatus("Searching…");
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
map.on("click", (e) => setDest({ lat: e.latlng.lat, lon: e.latlng.lng }));
$("radius").addEventListener("change", () => dest && setDest(dest));
["fFree", "fPublic", "fStreet", "sort"].forEach((id) => $(id).addEventListener("change", render));
