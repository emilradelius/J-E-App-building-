// Small helpers shared by the map apps. No build step needed.
// Data comes from OpenStreetMap (free, no API key):
//   - Overpass API  -> places on the map (parking, truck stops…)
//   - Nominatim     -> turn a typed place name into coordinates
window.MapUtils = (() => {
  // Several free Overpass servers. We ask the first one, and if it hasn't
  // answered within a couple of seconds we also ask the next, and take
  // whichever answers first. Results are cached for 30 minutes.
  const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  const CACHE_MS = 30 * 60 * 1000;

  function cacheGet(key) {
    try {
      const hit = JSON.parse(localStorage.getItem(key) || "null");
      return hit && Date.now() - hit.t < CACHE_MS ? hit.v : null;
    } catch { return null; }
  }
  function cacheSet(key, v) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch { /* storage full: skip cache */ }
  }
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return "ovp:" + h;
  }

  async function overpass(query, { timeoutMs = 20000, staggerMs = 2500 } = {}) {
    const key = hash(query);
    const cached = cacheGet(key);
    if (cached) return cached;

    let done = false;
    const controllers = [];
    const attempt = (url, delay) =>
      new Promise((resolve, reject) => {
        setTimeout(async () => {
          if (done) return reject(new Error("cancelled"));
          const ctrl = new AbortController();
          controllers.push(ctrl);
          const timer = setTimeout(() => ctrl.abort(), timeoutMs);
          try {
            const res = await fetch(url, {
              method: "POST",
              body: "data=" + encodeURIComponent(query),
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              signal: ctrl.signal,
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const json = await res.json();
            if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(json.remark);
            resolve(json.elements || []);
          } catch (e) {
            reject(e);
          } finally {
            clearTimeout(timer);
          }
        }, delay);
      });

    // Start with the server that answered last time.
    let order = OVERPASS_SERVERS;
    try {
      const fav = localStorage.getItem("ovp:fastest");
      if (fav && OVERPASS_SERVERS.includes(fav)) order = [fav, ...OVERPASS_SERVERS.filter((u) => u !== fav)];
    } catch {}

    try {
      const elements = await Promise.any(
        order.map((u, i) => attempt(u, i * staggerMs).then((els) => {
          try { localStorage.setItem("ovp:fastest", u); } catch {}
          return els;
        }))
      );
      done = true;
      controllers.forEach((c) => c.abort());
      cacheSet(key, elements);
      return elements;
    } catch {
      done = true;
      throw new Error("The free map-data servers are busy right now. Wait a moment and try again.");
    }
  }

  async function geocode(text) {
    const cached = cacheGet("geo:" + text.toLowerCase());
    if (cached) return cached;
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(text);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Place search failed (" + res.status + "). Try again, or tap the map instead.");
    const [hit] = await res.json();
    if (!hit) throw new Error("No place found for “" + text + "”");
    const out = { lat: +hit.lat, lon: +hit.lon, label: hit.display_name };
    cacheSet("geo:" + text.toLowerCase(), out);
    return out;
  }

  // Distance in metres between two {lat, lon} points
  function distance(a, b) {
    const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function fmtDist(m) {
    return m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(m < 10000 ? 1 : 0) + " km";
  }

  // Position of an OSM element (node, or way/relation with "out center")
  function pos(el) {
    if (el.lat != null) return { lat: el.lat, lon: el.lon };
    if (el.center) return { lat: el.center.lat, lon: el.center.lon };
    if (el.geometry && el.geometry.length) return { lat: el.geometry[0].lat, lon: el.geometry[0].lon };
    return null;
  }

  function bboxString(map) {
    const b = map.getBounds();
    return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((n) => n.toFixed(5)).join(",");
  }

  function baseMap(el, center, zoom) {
    const map = L.map(el, { zoomControl: true }).setView(center, zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    return map;
  }

  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Location not available in this browser"));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => reject(new Error("Couldn't get your location (permission denied?)")),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function dotIcon(color, size = 14) {
    return L.divIcon({
      className: "",
      html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  return { overpass, geocode, distance, fmtDist, pos, bboxString, baseMap, locate, esc, dotIcon };
})();
