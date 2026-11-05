# Truck Break Planner — build research and decisions

*Claude, 2026-11-04. Follows [trucking-competitors.md](trucking-competitors.md), which found the gap:
no European phone app plans EU breaks along the route **and** picks a stop with a free truck space.*

## What we built (v1)

`apps/truck-stops/index.html`, the **Truck Break Planner**:

1. The driver enters **from → to**, the departure time, and their **tachograph times**: driven since the last break, driven today, 10 h days used, short rests used, hours this week, and whether a 15 min first part was already taken.
2. They enter their **truck**: height, width, length, weight, axle load, and dangerous goods.
3. We get a **truck-safe route** (Valhalla truck routing on OpenStreetMap data).
4. We find **every truck stop, rest area, truck parking and truck fuel within 2 km of the route** (Overpass). Restaurants, toilets and showers next to a stop count as part of it.
5. The **EU rules engine** (`rules.js`, with tests) steps through the trip and works out the latest moment each break or daily rest is legally due.
6. For each stop it ranks the places in the hour before that moment (2 hours for a night rest). The score takes into account:
   - how late it is (using the driving time well),
   - the **chance of a free space** on arrival,
   - the facilities the driver asked for (food, shower, toilets, guarded),
   - the type of place,
   - the detour,
   - and, for night rest, avoiding fuel stations and preferring secure sites.
7. The driver can tap another option. The rest of the trip is then re-planned from that stop.
8. Drivers can report **🟢 spaces / 🟡 a few / 🔴 full**. Recent reports override the estimate, and older reports at the same time of day adjust it.
9. **Open in Google Maps with my stops** hands the trip to the driver's normal navigation.

The old map moved to `nearby.html` ("Truck stops near me").

## The EU rules we use

These come from Regulation (EC) 561/2006 as amended by Regulation (EU) 2020/1054 ([EUR-Lex summary](https://eur-lex.europa.eu/summary/EN/legissum:c00018), [UK guide to the EU rules](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/7655/1505039.pdf), [Driver Hire summary](https://www.driverhire.co.uk/resources/eu-drivers-hours/)).

| Rule | Value | In the app? |
|---|---|---|
| Break after driving | 45 min after max 4 h 30 min | ✅ |
| Split break | 15 min then 30 min | ✅ (tick "already took 15 min") |
| Daily driving | 9 h, 10 h max twice a week | ✅ |
| Daily rest | 11 h, or 9 h max 3 times between weekly rests | ✅ |
| Weekly driving | 56 h | ✅ warning |
| Two weeks | 90 h | ❌ not yet |
| Daily rest within 24 h of the end of the last one | | ❌ not yet. Long multi-day plans can break this |
| Split daily rest 3 h + 9 h | | ❌ |
| Weekly rest 45 h / 24 h, not in the cab | | ❌ |
| Ferry / train interruptions | | ❌ (matters for Sweden ↔ Germany/Finland) |

## Routing: options and prices

| Option | Truck restrictions | Live traffic | Price | Decision |
|---|---|---|---|---|
| **Valhalla on FOSSGIS** (`valhalla1.openstreetmap.de`, also used by openstreetmap.org) | ✅ height, width, length, weight, axle load, hazmat, from OSM tags | ❌ | Free, for light use only | **Using now** for testing |
| OSRM car (FOSSGIS) | ❌ | ❌ | Free | Fallback only, with a warning. Times slowed to truck speed |
| HERE Routing (truck) | ✅ very good, Europe-wide | ✅ | 5,000 free truck routes/month, then about €2.20 per 1,000 ([HERE pricing](https://developer.here.com/pricing)) | **Best candidate for launch** |
| Google Routes "Large Vehicle Routing" (Aug 2026) | ✅ | ✅ | Paid API ([FreightWaves](https://www.freightwaves.com/news/google-maps-just-launched-truck-aware-routing-that-knows-about-low-bridges-and-weight-limits-here-is-what-it-means-and-what-it-does-not)) | Check the price |
| GraphHopper | 🟡 `small_truck` profile, custom profiles on paid plans | 🟡 | About €59–69/month (third-party figures) ([GraphHopper](https://www.graphhopper.com/pricing/)) | Possible |
| Our own Valhalla server | ✅ | ❌ | Server cost only (~€40–80/month for Europe) | Later, if we grow |

OpenStreetMap restriction data (maxheight, maxweight, hgv=no) is good on Swedish main roads but patchy on small roads. **Trafikverket's NVDB** has official bridge heights and bearing capacity (BK1–BK4) for every Swedish road. Getting it from **Lastkajen** or the Trafikverket API would make Sweden more reliable than any OSM-based app.

## Parking data sources

| Source | What it has | Access | Status |
|---|---|---|---|
| OpenStreetMap (Overpass) | services, rest areas, parking with `hgv=designated`, `capacity:hgv`, toilets, showers, restaurants | Free | ✅ used |
| Our driver reports (Supabase) | spaces / a few / full, with time | Ours | ✅ built. The shared table **needs approval to switch on** |
| Trafikverket open API (Sweden) | ~215 rest areas (~175 truck-suitable), live occupancy at a few | Free API key ([Trafiklab](https://trafiklab.se/api/other-apis/trafikverket), [Trafikverket](https://www.trafikverket.se/e-tjanster/hamta-data-fran-trafikverket/)) | Next. Needs a key from Emil/Jacob |
| Statens vegvesen NVDB (Norway) | Rest areas (type 39) and truck overnight places "døgnhvileplass" (type 809) | Free API ([data.norge.no](https://data.norge.no/en/datasets/542d8ed0-e944-418b-b10e-6411d68fd5e2), [NVDB API](https://nvdbapiles-v3.atlas.vegvesen.no/)) | Easy win for Norway |
| EU SSTPA list | Certified secure parking levels | [eu-parkings.eu](https://eu-parkings.eu). Map/list, no known API | Could import by hand (few sites) |
| TRAVIS / SNAP | Bookable secure parking | Partner APIs | Later: "Book" button |
| Toll-data occupancy (as used by LKW.APP and Mercedes) | Estimated occupancy | Germany only (Toll Collect) | Not for us |

**Why driver reports matter:** IRU data says 83% of drivers and 86% of operators think there is too little safe truck parking in the EU ([Logistics Business](https://logisticsbusiness.com/transport-distribution/addressing-the-shortfall-of-adequate-truck-stops-in-europe-2/)). Sweden has almost no live parking data (Trafikverket's 2024–2025 reports: [2025](https://bransch.trafikverket.se/contentassets/7a4583dcccf8410194d095712be77531/arsrapportering-2025-regeringsuppdrag-sakra-uppstallningsplatser.pdf)). Our own reports are the realistic way to get "is it full?" in the Nordics.

**The "chance of a space" estimate today:**
- It starts from the time of day: easiest 06–15, hardest 21–05.
- It adjusts for size (`capacity:hgv`) and type.
- A driver report in the last 2 hours overrides the estimate if you arrive within 3 hours.
- Reports from the last 60 days at a similar hour (±2 h) shift it.

It's labelled as an estimate in the app.

## Reading the tachograph automatically (later)

Phones can't read a driver card by NFC alone. Today's apps use a USB/Bluetooth card reader (Tachogram, AETRControl, Driver Card Reader) or the **Bluetooth link of new Gen 2.2 smart tachographs** (VDO DTCO 4.1, Stoneridge SE5000-8.1, used by TachoData) ([Tachogram](https://tachogram.com/app), [TachoData listing](https://apps.apple.com/py/app/tachodata/id6737516213)). For v1 the driver types 2–3 numbers from the tachograph screen. A later version could read `.ddd` files that drivers already download, or connect to smart tachographs.

## Market size (Sweden)

About **415,000 people** hold a heavy truck licence (C) in Sweden. That is more than the number who drive for work. A heavy truck drove about 40,800 km on average in 2025 ([Trafikanalys](https://www.trafa.se/globalassets/statistik/vagtrafik/lastbilstrafik/2026/lastbilstrafik-2025.pdf), [SCB](https://www.scb.se/contentassets/49ca1153f261460ca68ed138790933db/uf0515_2025a01_br_am76br2501.pdf)). The real target is long-haul drivers who take EU breaks on the road, probably tens of thousands in Sweden, plus foreign drivers passing through.

## Next steps (in order)

1. **Switch on shared reports.** Apply `supabase/migrations/20261104_truck_parking_reports.sql`.
2. **Test on a real trip** (e.g. Malmö → Stockholm on the E4/E6) and note wrong stops or missing truck parking.
3. **Trafikverket API key.** Add official Swedish rest areas, live parking and NVDB bridge heights.
4. Add the **24 h daily-rest window** and **ferry rules** (Trelleborg, Ystad, Kapellskär, Umeå–Vaasa).
5. **HERE truck routing** with live traffic, once we have users. The free tier is 5,000 routes/month.
6. **Talk to 5–10 drivers.** Ask whether they would switch for this, and whether they'd pay.
