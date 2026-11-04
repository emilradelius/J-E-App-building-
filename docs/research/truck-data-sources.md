# Truck data: every source we can use, and what's switched on

*Claude, 2026-11-04. Goal: get as much truck parking, traffic and price data as we legally can, so the Break Planner can show live data and good probabilities.*

## How the data flows

```
Official open data ──► Edge Function "collect-truck-data" (runs on a schedule) ──► Supabase tables
OpenStreetMap      ──► the app asks Overpass live for each route ─────────────────► stops on the route
Drivers            ──► "🟢 spaces / 🟡 a few / 🔴 full" + planned stops ─────────────► Supabase tables
                                         │
                       truck_fullness_by_hour (how full, by weekday + hour)
                                         ▼
                     "Chance of a space" for each stop in the planner
```

| Table | What's in it | Filled by |
|---|---|---|
| `truck_sites` | Official truck parking sites: name, position, truck spaces, facilities, closed flag, raw record | Collector |
| `truck_site_status` | Live occupancy readings over time (free / few / full / counts) | Collector (once a live feed is connected) |
| `truck_parking_reports` | Driver reports: free / few / full | App |
| `planned_stops` | **Anonymous** planned stops: place, break or rest, arrival and leave time | App (when the driver opens the plan in Google Maps) |
| `raw_snapshots` | Log of every download, with the raw answer, so we can re-read it later | Collector |
| `truck_fullness_by_hour` (view) | Average fullness per place × weekday × hour, from reports + live readings (last 180 days) | Computed |

**`planned_stops` is something no competitor has.** If 15 drivers plan to stop at the same rest area at 21:00, we can warn the 16th *before* it is full. It's anonymous: no user, no start point, no destination.

## Switched ON now ✅

| Source | Data | Status |
|---|---|---|
| **Autobahn GmbH API** (Germany) — `verkehr.autobahn.de/o/autobahn/{road}/services/parking_lorry` ([API spec](https://github.com/bundesAPI/autobahn-api/blob/main/openapi.yaml)) | **1,825 truck parking sites on 113 motorways, 46,739 truck spaces**: showers, restaurants, hotels, DocStop, police, closed flag, and which sites have space sensors | ✅ Imported. Refreshes daily at 03:17 |
| **Statens vegvesen NVDB API Les v4** (Norway): types 809 "døgnhvileplass" and 39 "rasteplass" ([NVDB API](https://nvdbapiles.atlas.vegvesen.no/)) | **643 places, 2,964 truck spaces**: 64 official overnight truck rest places, plus 579 rest areas with truck spaces. Includes toilets, showers, kiosk/café, Wi-Fi, cameras, guards, lighting, fuel, truck power, ADR, booking and space-sensor flags | ✅ Imported. Refreshes daily at 03:37. Overnight places are preferred for night rests |
| **Check-ins** ("📍 Check in where I'm parked") | GPS-confirmed: the driver is within 500 m, then says free/few/full. Also lets drivers add **new** truck parking spots | ✅ In the app. Counted as *verified* (double weight) once migration `20261104_truck_checkins.sql` is approved |
| OpenStreetMap (Overpass) | Truck stops, rest areas, hgv parking, fuel, restaurants, toilets, showers in all of Europe | ✅ Live in the app for each route |
| Driver reports | free / few / full | ✅ Shared table on |
| Planned stops | Who will be where, when | ✅ On |
| Valhalla truck routing (FOSSGIS) | Truck-safe route | ✅ |

## Needs Emil or Jacob to sign up (free) 🔑

These are the **best live sources**, but they need a person to register. Once there's a key, I add it as a Supabase secret and the collector starts using it.

| # | Source | What we get | How to sign up | Why it matters |
|---|---|---|---|---|
| 1 | **Trafikverket open API** (Sweden) | ~215 rest areas (Parking object), roadworks, accidents, road weather, live traffic flow, ferry status | Free key at [Trafiklab](https://www.trafiklab.se/api/trafiklab-apis/trafikverket/) or [Trafikverket](https://www.trafikverket.se/e-tjanster/hamta-data-fran-trafikverket/) | Our home market. The collector is **already written and scheduled every 10 min**; it only needs the secret `TRAFIKVERKET_API_KEY` |
| 2 | **Toll Collect SID** via Mobilithek (Germany) | **Live truck parking occupancy for every German motorway rest area, updated every minute** (counts, % and free/almost full/full), from truck toll GPS + sensors. Live since 2 June 2026 | Free registration with Toll Collect + a Mobilithek account ([BMV](https://www.bmv.de/SharedDocs/DE/Artikel/K/lkw-stellplatzinformationsdienst-sid.html), [SID data & registration (PDF)](https://company.toll-collect.de/static/media/dokumente/sid/sid-data-and-registration-en.pdf), [Toll Collect SID overview](https://company.toll-collect.de/static/media/dokumente/sid/sid-overview-en.pdf)) | **The biggest single win.** Germany is where Swedish long-haul drivers struggle most to find parking. Format: DATEX II v2 (ParkingTablePublication + ParkingStatusPublication) |
| 3 | **Tankerkönig** (Germany) | Live diesel price at every German fuel station (MTS-K, CC BY 4.0) | Free key at creativecommons.tankerkoenig.de ([info](https://creativecommons.tankerkoenig.de)) | "Cheapest diesel on your route" through Germany |
| 5 | Digitraffic (Finland) | Road weather (350+ stations), roadworks, traffic. CC BY 4.0 ([service overview](https://www.digitraffic.fi/en/service-overview/)) | No key | Finland routes. No truck parking found |
| 6 | Flanders (Belgium) DATEX II truck parkings | Static truck parking ([transportdata.be](https://transportdata.be/dataset/?page=4)) | Open | Belgium coverage |
| 7 | Czech motorway truck parking | Real-time occupancy as open DATEX II ([CDV](https://cdv.gov.cz/en/provision-of-traffic-information-in-real-time-on-ten-t-network-parking-areas-for-heavy-vehicles-on-czech-motorway-network)) | Check registration | Live data for drivers going south-east |
| 8 | EU Safe & Secure Truck Parking list | Certified security level ([eu-parkings.eu](https://eu-parkings.eu)) | Map/list only | Show 🔒 level per site |
| 9 | Trafikverket NVDB via Lastkajen | Official bridge heights and bearing classes BK1–BK4 for every Swedish road | Free account | Better truck routing in Sweden than OSM |

**Background:** EU Delegated Regulation 885/2013 requires member states to publish truck parking information through national access points. That's why so much of this is open ([EU page](https://transport.ec.europa.eu/transport-themes/smart-mobility/road/its-directive-and-action-plan/safe-and-secure-truck-parking_en), [DATEX II truck parking profile](https://docs.datex2.eu/recommended-profiles/rrp/truck-parking/)). The EU-level access point only has static data so far. Live data has to come from each country.

## What we will NOT scrape ❌ (and why)

You asked me to scrape everything. I didn't scrape these, because the legal risk could sink the app:

| Source | Why not |
|---|---|
| LKW.APP, Truck Parking Europe, Truckfly, Trucker Path, SNAP, TRAVIS apps | Their terms forbid it. The EU Court said in *Ryanair v PR Aviation* (C-30/14) that sites can ban scraping by contract, and in *CV-Online v Melons* (C-762/19) that copying a substantial part of a database that took real investment can break the EU database right ([summary](https://www.pinsentmasons.com/out-law/news/website-operators-can-prohibit-screen-scraping-of-unprotected-data-via-terms-and-conditions-says-eu-court-in-ryanair-case), [C-762/19](https://www.medialaws.eu/ecj-clarifies-database-directive-scope-in-screen-scraping-case/)) |
| Google Maps (places, reviews, "popular times") | Google's terms forbid scraping. The legal route is the paid Places API |
| Personal data (driver names, number plates, exact trips) | GDPR. We only store anonymous place + time |

**What we can do instead (and what works better):**
- **Partner.** TRAVIS and SNAP *want* bookings. Ask for an affiliate or API deal: their sites in our app, a commission to us.
- **Ask operators.** Truck stop chains (Rasta, Circle K, OKQ8, Preem, St1, Q8, Autohöfe) can push their occupancy to us. Toll Collect lets private operators register since Aug 2026, and we could do the same for the Nordics.
- **Grow our own data.** Every report and planned stop makes the predictions better. That data is ours.

## Next data steps (in order)

1. 🔑 **Emil/Jacob: get a Trafikverket key** → I add it as a secret, and Swedish rest areas start flowing within 10 minutes.
2. 🔑 **Emil/Jacob: register for Toll Collect SID + Mobilithek** → I write the DATEX II reader, and live German occupancy fills `truck_site_status` every 5–10 minutes.
3. ✅ Done: Norway NVDB rest areas and overnight places.
4. 🔑 Tankerkönig key → cheapest diesel along the route in Germany.
5. ✅ Done: "Check in" button. **Needs approval:** the check-ins migration (marks GPS-confirmed reports as verified).
6. When `truck_site_status` has a few weeks of German data, check how good our time-of-day estimate is and tune it.

## Small technical notes

- The Supabase security check shows two minor notes, both fine for now. `raw_snapshots` has no public policy on purpose (only the collector can read it). pg_net sits in the public schema, which is the Supabase default.
- The collector won't run a source more often than its minimum gap (Autobahn: 6 h, Trafikverket: 10 min), so a stranger calling the function can't hammer the sources.
