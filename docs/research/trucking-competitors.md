# Trucking app competitors — does our idea already exist?

*Research by Claude, 2026-11-04, for the Truck Stop Map & Break Planner (`apps/truck-stops/`).*

**Short answer:** almost every *piece* of our idea already exists, usually several times over.
What we did **not** find is one simple, driver-first app that does all of these together:

- reads how much driving time you have left (from the tachograph, or typed in),
- plans the 45-minute breaks and the daily rest **along the route**,
- picks a stop for each break that is likely to have **free truck parking** and the facilities you want (food, showers, security),
- and covers **Sweden/the Nordics** well.

The closest are **Garmin dēzl** (a hardware sat-nav), **Trucker Path** (US only), and fleet software like **Volvo Dynafleet** (sold to haulage companies, not drivers).
See the [conclusion](#conclusion-where-is-the-gap) at the bottom.

> **How sure are we?** Most of the sources are app-store listings, company press releases and trade press.
> Prices change often, and several features could not be checked without installing the app.
> Things marked "?" were not confirmed.

---

## Comparison table

Legend: ✅ yes · 🟡 partly / basic · ❌ no · ? not confirmed

| App | Truck routing (height, weight, hazmat) | Live traffic | Cheapest / fuel route | Break planning tied to driving-time rules | Reads tachograph | Truck parking finder | Live parking availability | Book parking | Amenities / security info | Regions | Price (approx.) | How close to our idea |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Sygic Truck & Caravan** | ✅ | ✅ (paid add-on) | 🟡 toll costs | 🟡 suggests rest stops inside the break window (pro/fleet version) | 🟡 via fleet integrations | ✅ | ? | ❌ | 🟡 | EU + US + more | ~€10/mo or ~€65–85 one-off for Europe; traffic extra | **High** for navigation, medium for breaks |
| **TomTom GO Expert / GO Truck** | ✅ | ✅ | ? | ❌ none found | ❌ | ✅ | ? | ❌ | 🟡 | Worldwide | App subscription; device extra (prices not checked) | Medium |
| **Garmin dēzl (LGV/OTR)** | ✅ | ✅ (via phone) | ? | ✅ warns 1 h before breaks and suggests spots on the route; you set the limits by hand | ❌ hours typed in by hand | ✅ (Truck Parking Europe data) | ✅ via Garmin Drive app | ❌ | ✅ showers, Wi-Fi, security | EU + US versions | Buy a device (several hundred €; not checked) | **Closest overall**, but needs a separate device and no tachograph link |
| **Trimble CoPilot Truck** | ✅ | ✅ | 🟡 fuel prices | 🟡 in fleet setups | 🟡 fleet | ✅ | 🟡 "predictive parking" announced | ✅ via TRAVIS (EU) / Truck Parking Club (US) | 🟡 | EU + US | Sold mostly to fleets | Medium (fleet-focused) |
| **HERE WeGo Pro** (launched Feb 2025) | ✅ | ✅ | ? | ❌ none found | ❌ | ✅ along the route | ? | ❌ | ? | Worldwide | Fleet licence | Low–medium |
| **HERE WeGo** (free app) | ❌ (truck mode only in Pro) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Worldwide | Free | Low |
| **Google Maps** | ❌ in the app. Since Aug 2026 Google sells a truck routing **API** to developers | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Worldwide | Free app | Low (but the API could be **our** routing engine) |
| **PTV Navigator** | ✅ | ✅ | ✅ (PTV's strength) | ❌ none found | ❌ | ✅ (Truck Parking Europe data) | ? | ❌ | 🟡 | Europe | 30-day trial, then subscription | Medium |
| **Truck Parking Europe** (LogPay/PTV) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 26,000+ areas | 🟡 driver reports | ✅ secure sites | ✅ | Europe | Free app | Medium (parking only) |
| **TRAVIS** (Road Services) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 750+ secured sites | ✅ | ✅ | ✅ | 16–26 EU countries | Pay per booking | Low–medium (booking network) |
| **SNAP / intruck** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 650–800 sites | ? | ✅ since 2025 | ✅ security | UK + Europe | Free app, pay for parking | Low–medium (booking network) |
| **LKW.APP** (Aparkado, DE) | 🟡 | ❌ | ❌ | ❌ | ❌ | ✅ 50,000+ spots | ✅ **forecast up to 15 h ahead** (traffic-light colours, toll data) | ✅ (TRAVIS) | ✅ | Europe (strongest in DE) | Free + Pro subscription | **High for parking** — our strongest parking competitor |
| **Truckfly** (Michelin) | 🟡 | ❌ | ❌ | ❌ | ❌ | ✅ 21,000+ POIs | 🟡 | ✅ (TRAVIS) | ✅ showers, food, wash | Europe | Free | Medium (POI directory) |
| **KRAVAG Truck Parking** (DE) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ incl. free space at haulier yards | 🟡 user reports | ✅ | 🟡 | Mainly Germany | Free | Low–medium |
| **Mercedes-Benz Trucks Remote App** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (~2,000 German motorway sites) | ✅ estimated from toll data (from Aug 2026) | ❌ | ? | Germany at launch | Free for Mercedes truck drivers | Low |
| **IRU TRANSPark** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 4,000+ sites, 40–60 countries | ❌ | ❌ | ✅ security filter | Europe + Asia | Free (looks unmaintained; last update 2022) | Low |
| **Trucker Path** | ✅ | ✅ | ✅ fuel optimisation | ✅ "HOS optimisation" (US rules) | 🟡 | ✅ | ✅ crowd-reported + prediction | ✅ 50,000+ spots (US) | ✅ | **US/Canada only** | Free + Gold ~$150/yr | **High — but US only.** This is roughly "our idea, for America" |
| **Hammer** | ✅ | ✅ | ❌ | ❌ | ❌ | 🟡 rest areas | ❌ | ❌ | 🟡 | US/Canada/Mexico | Free (optional supporter tiers) | Low (US) |
| **Odysseus** (Lithuania) | ✅ | ✅ | ? | 🟡 AI "Tacho Agent" answers rule questions | ✅ connects to tachograph | ? | ? | ❌ | ? | Europe | 14-day trial, then paid | **Medium–high, worth watching** |
| **Eurowag Truck Drive App** | ✅ (Sygic inside) | ✅ | 🟡 fuel network | 🟡 shows tachograph status | ✅ (fleet telematics) | ✅ | ? | ? | ? | Europe (52 countries) | For Eurowag fleet customers | Medium (fleet only) |
| **Volvo Dynafleet Driver Times** | 🟡 | ? | ? | ✅ plans the route around remaining driving and rest time | ✅ | ? | ❌ | ❌ | ❌ | Europe | Fleet subscription (Volvo trucks) | **High for break planning**, but fleet/Volvo-only |
| **Tachograph timer apps** (TruckerTimer, Tachogram, Driver Card Reader) | ❌ | ❌ | ❌ | 🟡 countdown and alarms, **no route** | ✅ some read the driver card | ❌ | ❌ | ❌ | ❌ | EU | Free–cheap | Medium (what our v0 timer does today) |

**Not found:** "Transporeon ParkPilot" — Transporeon (now part of Trimble) has no truck-parking app we could find; its parking offer goes through Trimble CoPilot + TRAVIS. "Drivers Assist" — no app with that name turned up; the nearest match is a new app, *Logifie Driver Assistant*, with a basic parking map. "ADAC Truck Service" — this is a **breakdown service** app, not a parking or route app.

---

## Write-up per competitor

### Navigation apps (truck routing)

**Sygic Truck & Caravan GPS** — The biggest phone truck sat-nav in Europe. Strong truck routing, offline maps, toll cost estimates, truck POIs. Since 2015 its professional version can suggest rest stops that fall inside the break window given by the tachograph, but this is mainly sold to fleets through the SDK and partners (e.g. Eurowag). For an ordinary driver it is mainly a very good sat-nav, not a break planner. Price: about €10/month or €65–85 for lifetime Europe maps; live traffic costs extra.
Sources: [App Store](https://apps.apple.com/gb/app/id992127700), [Sygic rest-stop planning (2015)](https://sygic.com/blog/2015/rest-stops-planning-according-the-regulations-with-new-release-of-sygic-truck-navigation), [Sygic long haul](https://www.sygic.com/business/industries/long-haul?r=topmenu).

**TomTom GO Expert (app + GO Expert Plus device)** — Truck routing by height, weight and cargo, avoids low bridges and emission zones, finds truck parking and fuel stops. We found **no** driving-time or break planning.
Sources: [TomTom GO Expert](https://www.tomtom.com/en_gb/navigation/mobile-apps/go-expert-app/), [App Store](https://apps.apple.com/gb/app/tomtom-go-navigation-maps/id884963367).

**Garmin dēzl (LGV in Europe, OTR in the US)** — The most complete "break planner" for a single driver. With *Break Planning* on, it warns you an hour before a break or the end of your driving day and **suggests stops along the route**. Truck parking comes from Truck Parking Europe with filters for showers, Wi-Fi and security, plus availability through the Garmin Drive phone app. Downsides: you buy a separate device, you type your hours in by hand (no tachograph link), and it is not an app on your phone.
Sources: [dēzl break planning manual](https://www8.garmin.com/manuals/webhelp/dezl580/EN-GB/GUID-C7732CB9-DE43-41E9-9F8F-C00F7B7E600E.html), [dēzl OTR manual](https://www8.garmin.com/manuals/webhelp/GUID-CB6B72DC-B946-4D6C-84F3-440DCE3A7256/EN-US/Dezl_OTR_610-710_OM_(NA)_EN-US.pdf).

**Trimble CoPilot Truck** — Truck sat-nav aimed at fleets. In Europe it links to TRAVIS so drivers can search and book secure parking along the route (750+ sites, 26 countries). In the US it links to Truck Parking Club. Predictive parking was announced.
Sources: [Trimble + TRAVIS](https://www.transporeon.com/en/company/press/trimble-travis-reliable-truck-parking-copilot-european-fleets), [Truck Parking Club in CoPilot](https://transportation.trimble.com/resources/blogs/how-were-changing-the-parking-game-with-truck-parking-club-in-trimble-copilot), [Samsara listing](https://www.samsara.com/uk/resources/marketplace/copilot-truck).

**HERE WeGo / HERE WeGo Pro** — The free HERE WeGo app is for cars. HERE launched **WeGo Pro** for trucks in February 2025: truck road network, routes that respect dimensions and weight, offline maps, and truck parking search along the route. It is sold to fleets. HERE's routing API is also one of our candidate routing engines.
Sources: [HERE press release](https://www.here.com/about/press-releases/here-technologies-unveils-here-wego-pro-a-truck-navigation-app-for-safer), [WeGo Pro truck features](https://docs.here.com/wego-pro/docs/truck-features).

**Google Maps** — The app still has **no truck mode**. In August 2026 Google started selling *Large Vehicle Routing* (height, weight, length, axles, hazmat) to developers as an API. That makes it a possible **routing engine for us**, not a competitor app.
Sources: [FreightWaves](https://www.freightwaves.com/news/google-maps-just-launched-truck-aware-routing-that-knows-about-low-bridges-and-weight-limits-here-is-what-it-means-and-what-it-does-not), [CCJ](https://www.ccjdigital.com/technology/trip-planning/article/15832921/google-maps-platform-adds-truck-fleet-navigation-tools).

**PTV Navigator** — German truck sat-nav from PTV, the company whose routing and toll-cost software many hauliers use for planning. It includes Truck Parking Europe's parking data along the route. No driving-time planning found. 30-day free trial.
Sources: [PTV Navigator](https://www.ptvlogistics.com/products/ptv-navigator), [ERTICO](https://erticonetwork.com/?p=4972).

**Odysseus GPS Truck Navigation** (Lithuania) — A newer app that combines truck navigation, a **tachograph connection** and an AI "Tacho Agent" that answers questions about driving and rest rules. This is the European app closest to "navigation + tachograph in one phone app". We could not confirm whether it places breaks on the route automatically. Its website was blocked in our research environment, so this is based on store listings.
Sources: [Similarweb listing](https://similarweb.com/app/google/lt.eurospektras.odysseus), [Product Hunt](https://www.producthunt.com/products/odysseus).

### Parking apps and networks

**Truck Parking Europe** (LogPay, formerly PTV) — The classic free European parking directory: 26,000+ parking areas, driver ratings and reports, and booking of secure sites. Its data also feeds Garmin and PTV.
Sources: [FreightWaves](https://www.freightwaves.com/news/technology-truck-parking-europe-is-helping-truckers-book-secure-parking-spots-online), [APKMirror listing](https://www.apkmirror.com/apk/logpay-transport-services-gmbh/truck-parking-europe).

**TRAVIS** — A booking network for 750+ secured parking sites. It sits behind CoPilot, LKW.APP and Truckfly, so drivers often book TRAVIS without opening the TRAVIS app.
Sources: [TRAVIS + LKW.APP](https://www.yourtravis.com/knowledge/lkw-app-travis-parking-booking/), [TRAVIS + Truckfly](https://www.yourtravis.com/knowledge/truckfly-travis-booking/).

**SNAP (intruck app)** — UK-based parking and payment network (650–800 sites). Number-plate entry, digital payment, and bookable spaces across Europe since 2025. Mainly paid for by the fleet.
Sources: [SNAP parking](https://snapacc.com/parking/), [Fleetpoint](https://www.fleetpoint.org/?p=92272), [Trans.info](https://trans.info/en/snap-bookable-parking-410908).

**LKW.APP** (Aparkado, Germany) — The **strongest parking competitor**. Shows how full each truck parking area is with traffic-light colours, and **forecasts occupancy up to 15 hours ahead** from its own model plus Toll Collect toll data. Drive mode shows the nearest parking with free spaces, services and arrival time. Bookings through TRAVIS. 50,000+ spots. Free + Pro.
Sources: [Transport Online](https://transport-online.de/en/news/truck-parking-spaces-real-time-data-app-181051.html), [HERE case study](https://www.here.com/learn/blog/how-aparkado-helps-truck-drivers), [App Store](https://apps.apple.com/us/app/lkw-app/id1618788306).

**Truckfly** (Michelin) — Free European POI app: parking, fuel, restaurants, showers, truck washes. About 330,000 active users a year. Books TRAVIS sites.
Sources: [Michelin](https://business.michelin.co.uk/blog/articles/your-truck-driver-app-michelin-truckfly), [App Store](https://apps.apple.com/app/id1050082939).

**KRAVAG Truck Parking** (German insurer) — Suggests free parking along the route, including spare space at haulier yards, and lets you book. Mainly Germany.
Sources: [R+V/KRAVAG](https://www.ruv.de/newsroom/themenspezial-kravag-truck-parking), [Verkehrsrundschau](https://www.verkehrsrundschau.de/nachrichten/transport-logistik/kravag-bringt-parkplatz-app-fuer-lkw-fahrer-an-den-start-2977708).

**Mercedes-Benz Trucks Remote App** — Since August 2026 it shows estimated free spaces at about 2,000 German motorway parking areas, worked out from toll data. A sign that truck makers are moving into this too.
Sources: [Daimler Truck](https://www.daimlertruck.com/en/newsroom/pressrelease/mercedes-benz-trucks-expands-remote-app-with-parking-search-for-truck-drivers-53561072), [Trans.info](https://trans.info/de/mercedes-zeigt-freie-lkw-stellplaetze-jetzt-direkt-in-der-fahrer-app-495073).

**IRU TRANSPark** — Free app from the international road transport union, with a security filter (guards, fences, CCTV). It looks unmaintained (last update 2022).
Sources: [App Store](https://apps.apple.com/app/id852979509), [OSHA good practice](https://eguides.osha.europa.eu/vehicle-safety/good-practices/transpark-safe-parking-trucks).

**EU Safe and Secure Truck Parking Areas (SSTPA)** — Official EU certification (bronze, silver, gold, platinum) under Regulation 2022/1012. The official list and map are at [eu-parkings.eu](https://eu-parkings.eu). Under 3% of EU truck parking spaces are certified. One source notes this list is **not available in other apps**, which is an easy win for us: show the official security level.
Sources: [IRU](https://iru.org/node/3396), [TT Club](https://www.ttclub.com/news-and-resources/news/article/advancing-safe-truck-parking-in-europe/), [ESPORG](https://esporg.eu/?p=1418).

### US apps

**Trucker Path** — The US version of "our whole idea": truck routing, crowd-reported **live parking**, parking prediction, fuel price comparison and fuel-optimised routing, **HOS (US driving-hours) optimisation**, weigh stations, and since recently 50,000+ reservable parking spots. Free + Gold (about $150/year). **Not available in Europe**, and it uses US rules, not EU 561/2006.
Sources: [Help center pricing](https://helpcenter.truckerpath.com/hc/en-us/articles/9398625000717), [Trucker Path Pro](https://truckerpath.com/blog/new-trucker-path-pro), [Reservations](https://www.pulse.bot/supply-chain/news/trucker-path-app-adds-paid-reservations-for-50000-spots-4dee58b2-91df-4264-a9c7-d07075192352/).

**Hammer** — Free US truck GPS (4.7★, 34,000+ reviews). It shows that a free, simple, driver-loved app can win against big brands. US/Canada/Mexico only.
Sources: [App Store](https://apps.apple.com/app/id1478863996), [App Pricing Lab](https://apppricinglab.com/iap/apple/1478863996).

### Driving-time and tachograph tools

**Volvo Dynafleet Driver Times** — Fleet service that tracks each driver's remaining driving time from the tachograph and **plans routes around driving and rest time**. This is the clearest example of tachograph-based break planning on a route, but it is for Volvo fleets, sold to the haulage company.
Source: [Dynafleet fact sheet](https://stpi.it.volvo.com/STPIFiles/Volvo/FactSheet/Dynafleet%20Driver%20times%20service_Eng_02_308568598.pdf).

**Eurowag Truck Drive App** — Sygic navigation plus live tachograph status, for Eurowag fleet customers.
Source: [Eurowag](https://www.eurowag.com/apps/truck-drive-app).

**Wialon driver app, CO3, Road511** — Fleet and telematics tools or developer APIs that work out remaining driving time and, in Road511's case, return where on a route the driver must stop. They are useful as **building blocks or partners**, not driver apps.
Sources: [Wialon](https://help.wialon.com/en/wialon-platform/user-guide/wialon-driver/viewing-your-tachograph-data), [CO3](https://co3.io/news/route-optimization-network-planning-tachograph-data), [Road511](https://dev.to/road511/hours-of-service-break-planning-right-on-the-route-2end).

**TruckerTimer, Tachogram, Driver Card Reader** — Phone timers and card readers. They count down your driving time and sound alarms, but have **no map and no route**. Our v0 timer already does more (range circle + reachable stops).
Sources: [TruckerTimer](https://apps.apple.com/gb/app/truckertimer/id555938334), [Tachogram](https://tachogram.com/app).

### Sweden / Nordics

- **No Swedish or Nordic app** came up that combines rest-area parking with driving and rest times. Swedish drivers seem to use the pan-European apps (Truck Parking Europe, Truckfly, Sygic, Garmin).
- **Trafikverket** has about **215 rest areas** on the main road network, and about **175** are judged suitable for trucks. Only about **6** reach even the lowest higher-security level. Rest areas were due to be published in the national road database **NVDB** in 2025. Trafikverket says it has real-time parking data for only a very small number of rest areas so far. ([Trafikverket report 2025](https://bransch.trafikverket.se/contentassets/7a4583dcccf8410194d095712be77531/arsrapportering-2025-regeringsuppdrag-sakra-uppstallningsplatser.pdf), [report 2024](https://bransch.trafikverket.se/contentassets/45e7e443c9194cd4bf308c3f36839229/arsrapportering-2024-regeringsuppdrag-sakra-uppstallningsplatser.pdf))
- Trafikverket's **open API** (free key) and **DATEX II** feed give live traffic, roadworks and road data. **Lastkajen** gives NVDB data, including bridge heights and weight limits. This is a strong, free data source for Sweden that the big international apps may not use in depth. ([Trafikverket open data](https://www.trafikverket.se/e-tjanster/hamta-data-fran-trafikverket/), [Trafiklab](https://trafiklab.se/api/other-apis/trafikverket))
- The portal nakordoni.eu lists about **260 truck parking areas in Sweden**, which shows how thin the coverage is. ([nakordoni.eu](https://nakordoni.eu/en/for_truck_drivers/parkings/se))

---

## Conclusion: where is the gap?

**Honest verdict:** the idea is **well covered in parts**, and big companies (Sygic, TomTom, Garmin, Trimble, HERE, Google) own truck navigation.
We should **not** try to build a better truck sat-nav. That is expensive, needs licensed map data, and others already do it well.

**What we did not find in Europe:** a phone app that a single driver can install, that

1. takes the driver's **remaining driving time** (typed in, or later read from the tachograph or driver card),
2. **places every break and the daily rest on the route automatically** using EU 561/2006 (4.5 h → 45 min, split 15+30, 9/10 h days, 11/9 h daily rest),
3. for each break, suggests **2–3 stops** that will likely have **free spaces when you arrive** and have what you need (restaurant, shower, security level),
4. and **re-plans live** when traffic or a full parking area changes things.

- Garmin does points 1–2 roughly, but on a separate device with hand-typed hours.
- LKW.APP does point 3, but does not plan breaks.
- Trucker Path does all of it, but only in the US.
- Dynafleet and Eurowag do 1–2, but only for fleet customers.

**Where J&E can be different:**

1. **"Where do I stop tonight?" planner, not a sat-nav.** Plan the breaks and the parking, then hand off to the driver's own navigation (Google Maps, Sygic, Waze) with one tap. That avoids competing on routing.
2. **EU break rules + parking availability in one screen.** No European app clearly combines both yet.
3. **Nordic first.** Use Trafikverket's free data (NVDB bridge heights and weights, live traffic, rest areas) and Nordic truck stops (Rasta, Circle K, St1, OKQ8, Preem). Swedish and Norwegian language. The international apps are strongest in Germany, not here.
4. **Official security level.** Show the EU SSTPA certification level, which other apps do not show.
5. **Free or cheap, built for one driver.** Most of the competition is sold to fleets. A free app with a cheap Pro tier (like Hammer and LKW.APP) is open.
6. **Later: read the tachograph or driver card** so no typing is needed (like Odysseus and Driver Card Reader do today).

**Biggest risks:** LKW.APP, Truckfly or Sygic could add break planning in one release. Parking availability data is hard to get (LKW.APP uses toll data, Trucker Path uses millions of users). In Sweden we would need our own driver reports, the same check-in idea as in the Car Parking Finder.

**Next step:** talk to 5–10 Swedish truck drivers. Ask which apps they use today and whether "plan my breaks + find a free spot" is something they would switch apps for.
