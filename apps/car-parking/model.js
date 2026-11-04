// Chance-of-a-free-spot estimate.
//
// Step 1 (now): a starting guess from time of day, day of week and the kind of
// parking. This is an educated guess, NOT measured data.
// Step 2 (grows with use): every "Found a spot" / "It was full" tap is stored
// with the time. Those real reports pull the estimate toward what people
// actually saw at that place and time. The more people use the app, the less
// the starting guess matters.
window.ParkingModel = (() => {
  // How busy a city centre usually is (0 = empty, 1 = packed), by hour.
  const WEEKDAY = [0.2, 0.15, 0.15, 0.15, 0.15, 0.2, 0.3, 0.45, 0.65, 0.75, 0.8, 0.82, 0.85, 0.82, 0.8, 0.8, 0.8, 0.75, 0.7, 0.62, 0.55, 0.45, 0.35, 0.25];
  const SATURDAY = [0.25, 0.2, 0.2, 0.15, 0.15, 0.15, 0.15, 0.2, 0.3, 0.45, 0.65, 0.8, 0.85, 0.85, 0.85, 0.8, 0.75, 0.7, 0.65, 0.65, 0.6, 0.5, 0.4, 0.3];
  const SUNDAY = [0.25, 0.2, 0.2, 0.15, 0.15, 0.15, 0.15, 0.15, 0.2, 0.3, 0.4, 0.5, 0.55, 0.55, 0.55, 0.5, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.25, 0.25];
  // Residents park on the street in the evening and at night.
  const RESIDENT_NIGHT = [0.35, 0.35, 0.35, 0.35, 0.35, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.25, 0.3, 0.35, 0.35, 0.35];

  const PRIOR_WEIGHT = 4; // the starting guess counts as 4 reports

  function demand(spot, when) {
    const h = when.getHours();
    const day = when.getDay();
    let d = (day === 0 ? SUNDAY : day === 6 ? SATURDAY : WEEKDAY)[h];
    if (spot.fee === "free") d += 0.15; // free spots fill first
    if (spot.fee === "paid") d -= 0.05;
    if (spot.kind === "street") d += 0.1 + RESIDENT_NIGHT[h];
    if (spot.capacity >= 200) d -= 0.25; // big garages rarely fill completely
    else if (spot.capacity >= 50) d -= 0.1;
    else if (spot.capacity > 0 && spot.capacity < 10) d += 0.1;
    return d;
  }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // checkins: [{ found: true/false, at: ISO string }] for this spot
  function estimate(spot, when, checkins = []) {
    const prior = clamp(1 - demand(spot, when), 0.05, 0.95);
    // Use reports from a similar time: same kind of day (weekday/weekend), within ±1.5 h.
    const weekend = (d) => d === 0 || d === 6;
    const t = when.getHours() + when.getMinutes() / 60;
    const similar = checkins.filter((c) => {
      const d = new Date(c.at);
      const ct = d.getHours() + d.getMinutes() / 60;
      const diff = Math.min(Math.abs(ct - t), 24 - Math.abs(ct - t));
      return weekend(d.getDay()) === weekend(when.getDay()) && diff <= 1.5;
    });
    // Reports from the last hour say what is happening right now, so they count more.
    let found = 0, total = 0;
    for (const c of similar) {
      const w = Math.abs(Date.now() - new Date(c.at)) < 3600e3 ? 3 : 1;
      total += w;
      if (c.found) found += w;
    }
    const p = (prior * PRIOR_WEIGHT + found) / (PRIOR_WEIGHT + total);
    return { p, reports: similar.length, label: p >= 0.6 ? "Good" : p >= 0.35 ? "Fair" : "Low" };
  }

  const COLOR = { Good: "var(--ok)", Fair: "var(--warn)", Low: "var(--bad)" };

  return { estimate, COLOR };
})();
