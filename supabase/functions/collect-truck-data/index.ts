// Edge Function: collect-truck-data
// Downloads truck parking data from open, official sources and stores it in
// Supabase. Called on a schedule by pg_cron (see migrations), or by hand:
//   POST /functions/v1/collect-truck-data   body: {"source":"autobahn"}
//
// Sources:
//  - autobahn:     Autobahn GmbH (Germany) — every truck parking area on the
//                  motorways, with truck space count, facilities, and closed flag.
//                  Free, no key. https://verkehr.autobahn.de/o/autobahn
//  - trafikverket: Trafikverket (Sweden) open API, object type "Parking"
//                  (rest areas). Needs secret TRAFIKVERKET_API_KEY (free from
//                  Trafiklab). Skipped until the key is set.
// Every run is logged in raw_snapshots (with the raw answer where it's small),
// so we can re-parse later.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Don't let anyone hammer the sources: minimum minutes between runs per source.
const MIN_GAP_MIN: Record<string, number> = { autobahn: 6 * 60, trafikverket: 10 };

Deno.serve(async (req) => {
  let body: { source?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }
  const sources = body.source && body.source !== "all" ? [body.source] : ["autobahn", "trafikverket"];
  const results: Record<string, unknown> = {};
  for (const s of sources) {
    try {
      if (!(s in MIN_GAP_MIN)) { results[s] = "unknown source"; continue; }
      if (await ranRecently(s)) { results[s] = "skipped (ran recently)"; continue; }
      results[s] = s === "autobahn" ? await autobahn() : await trafikverket();
    } catch (e) {
      results[s] = "error: " + (e as Error).message;
      await log(s, false, (e as Error).message, null);
    }
  }
  return Response.json(results);
});

async function ranRecently(source: string) {
  const { data } = await db.from("raw_snapshots").select("fetched_at").eq("source", source).eq("ok", true)
    .order("fetched_at", { ascending: false }).limit(1);
  return !!(data && data[0] && Date.now() - new Date(data[0].fetched_at).getTime() < MIN_GAP_MIN[source] * 60e3);
}

async function log(source: string, ok: boolean, note: string, payload: unknown) {
  await db.from("raw_snapshots").insert({ source, ok, note: note.slice(0, 500), payload });
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": "JE-truck-break-planner/1.0", ...(init?.headers || {}) } });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

// ---------------- Autobahn GmbH (Germany) ----------------
async function autobahn() {
  const base = "https://verkehr.autobahn.de/o/autobahn";
  const roadsJson = await getJson(base + "/");
  const roads: string[] = (roadsJson?.roads || []).map((r: string) => r.trim()).filter(Boolean);
  const sites = new Map<string, Record<string, unknown>>();
  let failed = 0;
  for (let i = 0; i < roads.length; i += 6) {
    const batch = roads.slice(i, i + 6);
    const answers = await Promise.allSettled(batch.map((r) => getJson(`${base}/${encodeURIComponent(r)}/services/parking_lorry`)));
    answers.forEach((a, k) => {
      if (a.status !== "fulfilled") { failed++; return; }
      for (const p of a.value?.parking_lorry || []) {
        const lat = parseFloat(p.coordinate?.lat), lon = parseFloat(p.coordinate?.long);
        if (!isFinite(lat) || !isFinite(lon) || !p.identifier) continue;
        const desc: string[] = p.description || [];
        const lkw = desc.join(" ").match(/LKW[^0-9]{0,20}(\d+)/i);
        sites.set("autobahn:" + p.identifier, {
          id: "autobahn:" + p.identifier,
          source: "autobahn",
          name: [p.title, p.subtitle].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
          lat, lon,
          country: "DE",
          road: batch[k],
          capacity_hgv: lkw ? parseInt(lkw[1], 10) : null,
          features: (p.lorryParkingFeatureIcons || []).map((f: { description?: string }) => f.description).filter(Boolean),
          is_blocked: String(p.isBlocked) === "true",
          raw: p,
          updated_at: new Date().toISOString(),
        });
      }
    });
  }
  const rows = [...sites.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("truck_sites").upsert(rows.slice(i, i + 500));
    if (error) throw new Error("save failed: " + error.message);
  }
  const note = `${roads.length} roads, ${rows.length} truck parking sites, ${failed} roads failed`;
  await log("autobahn", true, note, { roads, count: rows.length });
  return note;
}

// ---------------- Trafikverket (Sweden) ----------------
async function trafikverket() {
  const key = Deno.env.get("TRAFIKVERKET_API_KEY");
  if (!key) return "skipped (no TRAFIKVERKET_API_KEY secret yet)";
  const url = "https://api.trafikinfo.trafikverket.se/v2/data.json";
  let json: any = null, used = "";
  // We don't know which schema version is current, so try newest first.
  for (const v of ["1.4", "1.3", "1.2", "1.1", "1.0"]) {
    const xml = `<REQUEST><LOGIN authenticationkey="${key}" /><QUERY objecttype="Parking" schemaversion="${v}" limit="10000"></QUERY></REQUEST>`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.RESPONSE?.RESULT?.[0] && !j.RESPONSE.RESULT[0].ERROR) { json = j; used = v; break; }
  }
  if (!json) throw new Error("Trafikverket Parking query failed for all schema versions");
  const items: any[] = json.RESPONSE.RESULT[0].Parking || [];
  const rows = items.map((p) => {
    const m = String(p.Geometry?.WGS84 || "").match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)/i);
    if (!m) return null;
    const truck = findNumber(p, /lorry|truck|heavy|lastbil|tung/i);
    return {
      id: "trafikverket:" + (p.Id ?? p.ID ?? p.Name),
      source: "trafikverket",
      name: p.Name ?? null,
      lon: parseFloat(m[1]), lat: parseFloat(m[2]),
      country: "SE",
      road: p.LocationDescription ?? null,
      capacity_hgv: truck,
      features: [],
      is_blocked: false,
      raw: p,
      updated_at: new Date().toISOString(),
    };
  }).filter(Boolean);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("truck_sites").upsert(rows.slice(i, i + 500) as any[]);
    if (error) throw new Error("save failed: " + error.message);
  }
  // Keep the full raw answer: we don't know every field yet.
  const note = `schema ${used}: ${items.length} parking objects, ${rows.length} with a position`;
  await log("trafikverket", true, note, json);
  return note;
}

// Find a truck space count anywhere in a Trafikverket object (field names unknown yet).
function findNumber(obj: any, keyRe: RegExp): number | null {
  let found: number | null = null;
  const walk = (o: any, path: string) => {
    if (found !== null || o == null) return;
    if (typeof o === "number" && keyRe.test(path) && /count|number|spaces|capacity|antal/i.test(path)) { found = o; return; }
    if (typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, path + "." + k);
  };
  walk(obj, "");
  return found;
}
