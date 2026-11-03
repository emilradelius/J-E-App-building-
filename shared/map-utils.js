// Small helpers shared by the map apps. No build step needed.
// Data comes from OpenStreetMap (free, no API key):
//   - Overpass API  -> places on the map (parking, truck stops…)
//   - Nominatim     -> turn a typed place name into coordinates
window.MapUtils = (() => {
  const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  async function overpass(query) {
    let lastErr;
    for (const url of OVERPASS_SERVERS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (!res.ok) throw new Error("Map data server answered " + res.status);
        return (await res.json()).elements || [];
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Could not load map data");
  }

  async function geocode(text) {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(text);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Search failed (" + res.status + ")");
    const [hit] = await res.json();
    if (!hit) throw new Error("No place found for “" + text + "”");
    return { lat: +hit.lat, lon: +hit.lon, label: hit.display_name };
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
