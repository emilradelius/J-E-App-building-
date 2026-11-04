// Where user reports and check-ins are stored.
//
// For now everything is saved in this browser only (localStorage), so you can
// try the flow. To share reports between all users, swap LocalStore for a
// server-backed store with the same four functions.
window.Reports = (() => {
  const KEY_REPORTS = "parking:reports";
  const KEY_CHECKINS = "parking:checkins";

  const TYPES = {
    sign: { label: "Road sign / rule", color: "#2f6fed", keepDays: 365 },
    construction: { label: "Construction / closed", color: "#c27c0e", keepDays: 30 },
    full: { label: "Full right now", color: "#d64545", keepDays: 1 / 24 },
    free: { label: "Free spots right now", color: "#1f9d55", keepDays: 1 / 24 },
  };

  const read = (k) => {
    try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
  };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  };

  const LocalStore = {
    async listReports() {
      const now = Date.now();
      return read(KEY_REPORTS).filter((r) => now - new Date(r.at) < (TYPES[r.type]?.keepDays ?? 30) * 864e5);
    },
    async addReport(r) {
      const all = read(KEY_REPORTS);
      all.push({ ...r, id: crypto.randomUUID?.() || String(Date.now()), at: new Date().toISOString() });
      if (!write(KEY_REPORTS, all)) throw new Error("Phone storage is full. Try a report without a photo.");
    },
    async checkinsFor(spotId) {
      return read(KEY_CHECKINS).filter((c) => c.spot === spotId);
    },
    async addCheckin(spotId, found) {
      const all = read(KEY_CHECKINS);
      all.push({ spot: spotId, found, at: new Date().toISOString() });
      write(KEY_CHECKINS, all.slice(-2000));
    },
    async allCheckins() {
      return read(KEY_CHECKINS);
    },
  };

  // Shrink a photo before saving it (max 900 px, JPEG).
  function shrinkPhoto(file, max = 900) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("Couldn't read that photo"));
      img.src = URL.createObjectURL(file);
    });
  }

  return { TYPES, store: LocalStore, shrinkPhoto };
})();
