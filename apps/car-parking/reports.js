// Shared reports and check-ins, stored in Supabase so every user sees them.
//
// Tables (project "je-apps"):
//   parking_reports  — road signs, construction, full/free now (+ photo, + AI sign reading)
//   parking_checkins — "Found a spot" / "It was full" taps, with time and place
// Photos go to the public storage bucket "report-photos".
// Edge Function "read-sign" reads sign photos with Claude.
window.Reports = (() => {
  const { url, anonKey } = window.SUPABASE;
  const headers = { apikey: anonKey, Authorization: "Bearer " + anonKey };

  const TYPES = {
    sign: { label: "Road sign / rule", color: "#2f6fed", keepDays: 365 },
    construction: { label: "Construction / closed", color: "#c27c0e", keepDays: 30 },
    full: { label: "Full right now", color: "#d64545", keepDays: 1 / 24 },
    free: { label: "Free spots right now", color: "#1f9d55", keepDays: 1 / 24 },
  };

  async function rest(path, opts = {}) {
    const res = await fetch(url + "/rest/v1/" + path, {
      ...opts,
      headers: { ...headers, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error("Couldn't reach the report server (" + res.status + ")");
    const text = await res.text(); // inserts without "return=representation" reply with an empty body
    return text ? JSON.parse(text) : null;
  }

  const bboxFilter = (b) => `lat=gte.${b.s}&lat=lte.${b.n}&lon=gte.${b.w}&lon=lte.${b.e}`;
  const since = (days) => new Date(Date.now() - days * 864e5).toISOString();
  const photoUrl = (path) => (path ? `${url}/storage/v1/object/public/report-photos/${path}` : null);

  async function uploadPhoto(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const res = await fetch(`${url}/storage/v1/object/report-photos/${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/jpeg", "x-upsert": "false" },
      body: blob,
    });
    if (!res.ok) throw new Error("Photo upload failed (" + res.status + ")");
    return path;
  }

  const store = {
    // b = { s, w, n, e } map bounds
    async listReports(b) {
      const rows = await rest(`parking_reports?select=*&${bboxFilter(b)}&created_at=gte.${since(365)}&order=created_at.desc&limit=300`);
      const now = Date.now();
      return rows
        .filter((r) => now - new Date(r.created_at) < (TYPES[r.type]?.keepDays ?? 30) * 864e5)
        .map((r) => ({ ...r, at: r.created_at, photo: photoUrl(r.photo_path) }));
    },

    async addReport({ type, lat, lon, note, photo }) {
      const photo_path = photo ? await uploadPhoto(photo) : null;
      const [row] = await rest("parking_reports", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ type, lat, lon, note: note || null, photo_path }),
      });
      return row;
    },

    // Ask the AI to read a road-sign photo. Returns the reading or throws.
    async readSign(reportId) {
      const res = await fetch(`${url}/functions/v1/read-sign`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Sign reader failed (" + res.status + ")");
      return body.reading;
    },

    async checkinsNear(b) {
      return (await rest(`parking_checkins?select=spot,found,lat,lon,created_at&${bboxFilter(b)}&created_at=gte.${since(180)}&limit=5000`))
        .map((c) => ({ ...c, at: c.created_at }));
    },

    async addCheckin(spot, found, lat, lon) {
      await rest("parking_checkins", { method: "POST", body: JSON.stringify({ spot, found, lat, lon }) });
    },
  };

  // Shrink a photo before uploading it (max 1200 px, JPEG).
  function shrinkPhoto(file, max = 1200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("Couldn't read that photo"));
      img.src = URL.createObjectURL(file);
    });
  }

  return { TYPES, store, shrinkPhoto };
})();
