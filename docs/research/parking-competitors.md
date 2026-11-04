# Parking apps: who already does what? (competitor research)

*Researched by Claude on 2026-11-04 for the Car Parking Finder (`apps/car-parking/`).*

**The question:** is there already an app or website that does exactly what we want to build?

**Our concept, in three parts:**
1. **Chance of a free spot** by place and arrival time (statistics + live check-ins).
2. **Crowd-sourced sign photos read by AI**, building a shared, up-to-date map of the rules.
3. **"Where am I allowed to park, and what does it cost?"** for a destination.

> How this was researched: web searches across app stores, company help pages, press releases and news. Some sites (kth.se, mwm.ai, EasyPark's Swedish help centre) could not be opened from this environment, so for those the facts come from search-result summaries. App-store claims (accuracy, time saved) are the companies' own and were not tested.

---

## Short answer

**No single app does all three parts. But each part already exists on its own, and the biggest player in Sweden already does part 1 in Malmö.**

- **Part 1 is taken by EasyPark.** Its **FIND** feature colours streets green/yellow/red by the *chance of finding a spot* and routes you to the best street. It runs in **Malmö**, Stockholm and Uppsala. It is built on millions of real parking payments, which is data we can never match. EasyPark also bought **Parkopedia** (2025), the world's biggest parking database, which predicts "probability to find parking" per street segment.
- **Part 2 is half-taken.** At least four apps read Swedish parking signs from a photo with AI: **Nofine** (KTH startup), **LazeePark** (Lazee Technologies AB), **ParkAdviz** and **Parky** (Stockholm only). But they are **single-use**: you photograph a sign, get an answer, and that's it. None of them saves the result to a **shared map** for the next driver. **SpotAngels** (USA) built exactly that shared sign map from user photos, but it is not in Sweden.
- **Part 3 is partly done everywhere, but badly for street parking.** Payment apps (EasyPark, Parkster, Mobill, Aimo, APCOA FLOW) show their own paid zones and car parks. Nobody shows a neutral, complete picture that includes **free streets, time limits, service days (städdagar) and every operator** in one place.

**So the gap is not "predict availability" (EasyPark wins that). The gap is the shared, photo-based map of rules, especially free and time-limited street parking, across all operators.**

---

## Comparison table

✅ = yes · ◐ = partly / limited · ❌ = no · ? = unclear

| App / service | Chance of a spot | Reads signs with AI | Shared crowd-sourced rules map | "Where may I park" incl. free streets | Pay / book | Works in Malmö | Main data source | How it makes money |
|---|---|---|---|---|---|---|---|---|
| **EasyPark** (incl. FIND) | ✅ FIND, street colours | ❌ | ❌ | ◐ own paid zones | ✅ pay | ✅ (FIND too) | Payment transactions, Parkopedia, ML | Service fee per parking, subscriptions, data sales |
| **Parkopedia** (owned by EasyPark) | ✅ per street segment (B2B) | ❌ | ❌ | ◐ | ◐ | ◐ data | Operators, city data, sensors, car data, surveys, ML | Sells data to car makers, apps |
| **Parkster** | ❌ | ❌ | ❌ | ◐ own zones | ✅ pay | ✅ | Operators/municipalities | Per-minute fee, "Complete" add-on |
| **Mobill** | ❌ | ❌ | ❌ | ◐ own zones | ✅ pay + EV charging | ✅ (most municipalities) | Operators | Fees |
| **Aimo Park** | ❌ (Sweden) | ❌ | ❌ | ❌ own car parks | ✅ pay, rent | ✅ | Own car parks | Parking fees, rentals |
| **APCOA FLOW** | ❌ | ❌ (camera reads plates) | ❌ | ❌ own car parks | ✅ auto start/stop | ✅ (e.g. Emporia) | Own car parks, cameras | Parking fees |
| **Google Maps** parking difficulty | ◐ easy/medium/limited per destination | ❌ | ❌ | ❌ | ❌ | ? (not confirmed) | Historical location data, ML | Ads (free) |
| **Waze** "where to park" | ❌ | ❌ | ◐ community-added car parks | ❌ | ◐ via SpotHero (US) | ◐ car parks only | INRIX + community | Ads (free) |
| **INRIX** parking | ✅ (B2B, 7-day forecast) | ❌ | ❌ | ◐ digitised curb rules (mostly US) | ◐ | ? | Operators, cameras, cities, ML | Sells to cities, car makers |
| **SpotAngels** | ◐ | ◐ users photograph signs | ✅ the closest match to our idea | ✅ street rules, cleaning alerts | ◐ garage deals | ❌ US only | Crowd-sourced sign photos + imagery + OSM | Garage deals, premium |
| **SpotHero** | ❌ | ❌ | ❌ | ❌ garages | ✅ book in advance | ❌ US/Canada | Garage operators | Commission + booking fee |
| **ParkMobile** (owned by EasyPark) | ❌ | ❌ | ❌ | ◐ meters | ✅ pay | ❌ US | Cities | Transaction fee, subscription |
| **Nofine** (Sweden) | ❌ | ✅ Swedish signs | ❌ | ◐ one sign at a time | ❌ | ✅ | AI on your photo | 19 kr/month or 149 kr/year |
| **LazeePark** (Sweden) | ❌ | ✅ Swedish signs | ❌ | ◐ one sign at a time | ❌ | ✅ | AI on your photo | Free (as listed) |
| **ParkAdviz** | ❌ | ✅ Swedish signs | ❌ | ◐ one sign at a time | ❌ | ✅ | AI on your photo | ? |
| **Parky** (Stockholm) | ❌ | ? | ❌ | ✅ "får jag parkera här?" | ❌ | ❌ Stockholm only | Likely Stockholm's rule data | ? |
| **Parky.AI, Can I Park Here, ParkClear, ParkHelp, Parksy Sign Scanner, Pango Sign Scan** | ❌ | ✅ | ❌ | ◐ one sign at a time | Pango: ✅ | ◐ (photo works anywhere, tuned for US/Canada/Israel) | AI on your photo | Subscriptions / free |

---

## Write-up per competitor

### Sweden / Nordics

**EasyPark (Arrive group), the big one.** Swedish-founded, now in 20,000+ cities in 90+ countries. It owns ParkMobile (USA, since 2022), Flowbird (2025) and Parkopedia (2025). Its **FIND** feature (earlier called "Find & Park") colours streets green (high chance), yellow (medium) and red/orange (low) and sends you to the street with the best chance. It started in Stockholm and, according to EasyPark's own help pages, also covers **Malmö** and Uppsala. It uses its payment history plus "big data and machine learning" (from the startup PARKO, which it bought). EasyPark claims it halves search time; that is their own number. It also sells parking data to cities ("parking data as a service"). **This is the closest thing to our "chance of a spot" feature, and it already works in Malmö.** What it does not do: read signs, show free streets well, or let users report problems.

**Parkster.** Swedish payment app, in 550+ Swedish municipalities including Malmö and Lund. Start/stop/extend parking, per-minute billing, EV charging, map and zone codes. Mixed reviews (missed payments, fines despite paying). No availability prediction, no rule explanation.

**Mobill.** Swedish payment app for parking and EV charging, in most Swedish municipalities. Pay by card or invoice. Payment only.

**Aimo Park.** Large car-park operator (about 250,000 spaces at 6,000+ addresses in Sweden). App to find, pay and charge at its own car parks; replaced MobilPark. Real-time availability seems to exist in Norway, not confirmed for Sweden. Own car parks only.

**APCOA FLOW.** APCOA's app, 2,000+ car parks in Sweden, runs the Emporia car park in Malmö. Cameras read your plate so parking starts and stops automatically. Own car parks only.

**Nofine (KTH startup).** Calls itself "Europe's first app for scanning parking signs". Photograph a sign and see what applies to you right now, grouped by vehicle type (car, EV, motorcycle). Subscription: 19 kr/month or 149 kr/year. KTH reported about 35,000 downloads and 1,000 paying users at one point, with "mixed reception". Also offers an API. **This is a direct competitor to our sign reader.** It does not build a shared map.

**LazeePark (Lazee Technologies AB).** Swedish, free. Photograph a sign; AI tells you what applies for the time you choose. Single-use, no map.

**ParkAdviz.** iOS app that reads Swedish parking signs from a photo and gives a verdict. Single-use.

**Parky (Stockholm).** Answers "får jag parkera här?" (may I park here?), shows fees, reminds you when to move the car, saves where you parked. Stockholm only, plans to expand. Probably uses Stockholm's own rule data, which Malmö does not offer in the same way. **The closest Swedish match to our "where may I park" idea.** (Not the same as Parky.AI below.)

**Municipal efforts.** Parkering Malmö owns 45,000+ spaces and has gone digital (permits, payment apps), but we found **no public sensor or "free spaces" app in Malmö**. In Denmark, Lemvig (Sensade sensors) and Aarhus (ParkaLot) show free spaces using sensors. Stockholm has the Betala P app and a city parking site. **Mapillary** (Swedish, Malmö-founded, now owned by Meta) read parking signs from street imagery for cities back in 2018.

### Global

**Parkopedia (now EasyPark).** The world's largest parking database, mainly sold to car makers for in-car navigation. Mixes operator data, city open data, sensors, car sensors, payments, imagery and ground surveys, then predicts "probability to find parking" per street segment. Covers on-street data in 500+ cities. It argues predictions beat real-time sensors for on-street parking. Same idea as ours, at industrial scale.

**INRIX.** Traffic data company. In June 2026 it announced predictive parking covering 22,000 cities, forecasting demand up to 7 days ahead, and digitised curb rules for 500,000 street segments (mostly US). Sells to cities and car makers, not drivers. It supplies Waze's parking data.

**Google Maps parking difficulty.** Since 2017 a small "P" icon on the directions card shows Easy / Medium / Limited parking at your destination, based on historical data and machine learning. Not live, no rules, no prices. Launched in 50 cities in the US and elsewhere; we could not confirm it covers Malmö.

**Waze.** "Where to park" suggests car parks near your destination (INRIX data + community-added car parks). No on-street prediction, no rules. A user request to report "leaving a parking spot" exists but has not been built.

**SpotAngels (USA).** **The closest match to our full concept.** Started by crowd-sourcing photos of parking signs because city data was wrong, then added satellite and street imagery. Users can add or edit rules. Shows free street parking, street-cleaning alerts and garage deals. US cities only. Its weakness: users report wrong rules, prices and availability. That shows how hard keeping crowd data correct is.

**SpotHero (USA/Canada).** Book garage spots in advance. Takes a commission plus a booking fee. Not on-street, not Europe.

**ParkMobile (USA, owned by EasyPark).** Pay at city meters. Per-transaction fee or subscription. Payment only.

**AI sign readers (global).** Parky.AI (Montreal, about 83% accurate on simple signs and 74% on complex ones, per press), Can I Park Here (NYC), Can I Park Here AI, ParkClear, ParkHelp, ParkBuddy, Parking Dad, Parksy Sign Scanner (free, in the browser), and **Pango Sign Scan** (Israel). Pango is notable because it is a **payment app that added sign reading**, combining it with your car and location. Payment apps in Sweden could copy that. We found no apps named "ParkSmart" or "Parking Sign Decoder" that read signs.

---

## Conclusion: does this exact thing already exist?

**Honest answer: the idea is well covered piece by piece, but nobody has put the pieces together in Sweden.**

| Our part | Already done by | How strong is the competition? |
|---|---|---|
| Chance of a spot by time | EasyPark FIND (in Malmö), Parkopedia, INRIX, Google | **Very strong.** EasyPark has years of real payment data. We cannot beat them on paid streets. |
| AI reads sign photos | Nofine, LazeePark, ParkAdviz, Parky.AI, Pango… | **Crowded.** Reading one sign is now easy with AI. Not a reason for people to switch apps. |
| Shared, crowd-built map of rules | SpotAngels (US only) | **Open in Sweden.** No one does this here. |
| Free + time-limited street parking, all operators, one map | Parky (Stockholm only, partly) | **Open in Malmö.** Payment apps only show their own paid zones. |

### Where the gap is

1. **Free and time-limited parking.** EasyPark only knows streets where people pay through EasyPark. Free streets, "2 tim" disc zones, residential streets and service days are invisible in its data. This is exactly where Malmö drivers get fined and where people search longest.
2. **A shared map that fills itself.** Sign apps throw away every photo after answering. If every photo becomes a pin with the rule on the map, the next driver doesn't need to photograph anything. This is our real "gets better the more people use it" effect, and nobody in Sweden has it.
3. **Operator-neutral.** Sweden has 5+ payment apps and a car park may only accept one. A neutral map that says "this spot: free 2 h, or pay with Parkster, 15 kr/h" is something no payment company has a reason to build.
4. **Temporary changes.** Construction, events and "full now" reports are not in anyone's data.

### What J&E should focus on

- **Don't compete head-on on "chance of a spot" for paid streets.** Keep our estimate, but treat it as a bonus, not the main selling point. For paid zones, EasyPark will be better.
- **Make the main promise: "Can I park here, for how long, and what does it cost? Including free spots."** Build it on the shared sign-photo map, plus official rules (Transportstyrelsen RDT / Malmö data) if we get access.
- **Every sign photo should improve the map**, not just give one answer. Show "rule confirmed by 3 drivers, last seen 5 days ago" to build trust (SpotAngels' accuracy complaints show trust is the hard part).
- **Go deep in Malmö first** (one city, done well, as SpotAngels and Parky did).
- **Consider partnering instead of fighting**: Nofine already offers a sign-reading API; payment apps might want our free-parking and rule data. A future business could be selling the rule map, as Parkopedia does.
- **Risk to keep in mind:** EasyPark (or Parkster) could add sign reading to their app, as Pango did in Israel. Our protection is the shared map and community data, not the AI reading itself.

---

## Sources

**EasyPark / FIND**
- [What is FIND (EasyPark help, BE)](https://www.easypark.com/en-be/help/the-parking-app/wat-is-find-what-is-find-and-how-does-it-help-you-park--18660965279644)
- [What is FIND (EasyPark Sweden support)](https://se.support.easypark.com/hc/en-us/articles/25492116455964-What-is-FIND)
- [Where can I use FIND? (EasyPark help)](https://easypark.com/en-at/help/parking-app/find-function-where-can-i-use-find--19126281088796)
- [Where can I use Find & Park? (lists Malmö)](https://www.easypark.com/en-sk/help/parking-app/funkcia-find-where-can-i-use-find-and-park--18741280494236)
- [What do the colours on the streets mean (EasyPark help)](https://www.easypark.com/en-dk/help/parking-app/the-colors-on-the-streets-what-do-they-mean--the-colors-on-the-streets-what-do-they-mean--17899784343068)
- [EasyPark Group launches Find & Park in Stockholm (Parking.net)](https://www.parking.net/parking-news/easypark-group/launches-find-park-service-stockholm)
- [EasyPark halves time spent searching with predictive technology (Parking.net)](https://www.parking.net/parking-news/easypark-group/new-parking-technology)
- [EasyPark acquires PARKO (Parking.net)](https://www.parking.net/parking-news/easypark-group/acquires-parko)
- [EasyPark: parking data as a service](https://easyparkgroup.com/our-offer/offer-parking-data-as-a-service)
- [EasyPark Group: one of Europe's fastest growing companies (Arrive)](https://arrive.com/en/newsroom/news/easypark-group-one-of-europe-s-fastest-growing-companies)
- [EasyPark finalises Parkopedia acquisition (ITS International)](https://d10dev.itsinternational.com/news/easypark-finalises-parkopedia-acquisition?page=113)
- [EasyPark closes Flowbird deal (TransportXtra)](https://www.transportxtra.com/publications/evolution/news/77523/easypark-closes-flowbird-deal)
- [Realtid: Sweden's most-parked streets](https://www.realtid.se/rapport-har-ar-sveriges-mest-parkerade-gator)

**Swedish payment apps and operators**
- [Parkster (App Store, SE)](https://apps.apple.com/se/app/parkster-smidig-parkering/id533140250)
- [Parkster website](https://www.parkster.com/se/en)
- [Parkster reviews (JustUseApp)](https://justuseapp.com/en/app/533140250/parkster-einfach-parken/reviews)
- [Mobill (App Store)](https://apps.apple.com/gb/app/mobill-parking/id1066302005)
- [Aimo Park Sweden](https://www.aimopark.se/en/)
- [Aimo app manual](https://www.aimopark.se/globalassets/documents/dok-se/aimo-app-manual-swedish.pdf)
- [APCOA FLOW (APCOA Sweden)](https://www.apcoa.se/en/hitta-parkering/bokning-och-betalningsalternativ/apcoa-flow)
- [APCOA becomes operator for Emporia, Malmö (Parking.net)](https://www.parking.net/parking-news/apcoa/becomes-parking-operator-for-emporia-shopping-center-in-malmoe)

**Swedish sign readers and "may I park here"**
- [Nofine (App Store, SE)](https://apps.apple.com/se/app/nofine/id6444793648?l=en-GB)
- [Nofine (KTH Innovation)](https://www.kth.se/en/om/innovation/alumner/bolag/kth-startups-i-batch-16/nofine-1.1207840)
- [Frustration over parking fines led to innovation (KTH)](https://www.kth.se/en/eecs/nyheter/frustration-over-parkeringsboter-ledde-till-innovation-1.1250331)
- [Dagens PS: Want to avoid parking fines? AI can help](https://www.dagensps.se/teknik/mobil/vill-du-slippa-p-boter-nu-kan-ai-hjalpa-dig/)
- [LazeePark (App Store)](https://apps.apple.com/dk/app/lazeepark/id1669625261)
- [ParkAdviz (app listing)](https://mwm.ai/apps/parkadviz/6754198493)
- [Parky, Stockholm (App Store)](https://apps.apple.com/in/app/parky/id1566369322)
- [M3: Find parking in Stockholm](https://www.m3.se/article/1841483/hitta-parkering-i-stockholm.html)
- [Parkiro AB (The Hub)](https://thehub.io/startups/parkiro-ab)

**Municipal / Nordic**
- [Parkering Malmö: invests in digital parking (2019)](https://www.pmalmo.se/globalassets/pressmeddelande/pm-13-november-2019-parkering-malmo-satsar-pa-digital-parkering.pdf)
- [Mobilitet Malmö report (2020)](https://www.pmalmo.se/contentassets/f02923cfd5164d58a881b5314b2134ff/rapport-budgetuppdrag-2020-mobilitet-malmo-.pdf)
- [Lemvig P-app shows free spaces (DK Nyt)](https://www.dknyt.dk/artikel/p-app-viser-ledige-pladser-og-ladestandere)
- [ParkaLot, Aarhus](https://dokkx.aarhus.dk/teknologierne/bytes-i-byen/parkalot)
- [Stockholm: paying to park](https://parkering.stockholm/en/paying-to-park/)
- [Mapillary + Amazon Rekognition for parking signs (VentureBeat)](https://venturebeat.com/2018/09/13/mapillary-strikes-computer-vision-partnership-with-amazon-rekognition-to-ease-urban-parking-crunch)

**Global**
- [Parkopedia: why predictions beat real-time](https://business.parkopedia.com/blog/why-predictions-beat-real-time-every-time)
- [Parkopedia parking data](https://business.parkopedia.com/data)
- [Parkopedia predicts on-street availability (VentureBeat)](https://venturebeat.com/ai/parkopedia-now-predicts-where-and-when-on-street-parking-will-be-available)
- [INRIX: predictive and accurate parking intelligence (June 2026)](https://inrix.com/press-releases/inrix-sets-the-standard-for-predictive-and-accurate-parking-intelligence/)
- [INRIX parking products](https://inrix.com/products/parking-data-software/)
- [Google: Put it in park with new features in Google Maps](https://blog.google/products/maps/put-it-park-new-features-google-maps)
- [TechCrunch: Google Maps parking difficulty (2017)](https://techcrunch.com/2017/01/26/google-maps-will-now-tell-you-how-bad-the-parking-is-at-your-destination)
- [Engadget: parking difficulty in 25 more cities](https://www.engadget.com/2017/08/29/google-maps-parking-difficulty-25-more-cities/)
- [INRIX selected by Waze for parking data](https://inrix.com/blog/inrix-selected-by-waze-to-supply-global-parking-data/)
- [Waze "leaving parking spot" suggestion](https://waze.uservoice.com/forums/59223-waze-suggestion-box/suggestions/50873222-add-a-leaving-parking-spot-community-report)
- [SpotAngels in Boston (Boston.com)](https://www.boston.com/cars/local-news/2018/12/04/spotangels-parking-boston/)
- [Why Google Maps' Street View brains invest in a parking app (Geoawesome)](https://geoawesome.com/why-google-maps-streetview-brains-are-investing-in-a-parking-app/)
- [SpotAngels (App Store)](https://apps.apple.com/es/app/id897809583)
- [SpotHero FAQ](https://spothero.com/faq)
- [ParkMobile review (Parksy)](https://parksy.com/blog/parkmobile-united-states-review-pros-cons-summary-services)

**AI sign readers (global)**
- [Parky.AI (App Store)](https://apps.apple.com/app/id6446705281)
- [Montreal AI parking sign app (Global News)](https://globalnews.ca/news/9716710/ai-parking-app-montreal-signs)
- [Can I Park Here AI (App Store)](https://apps.apple.com/app/id6744760181)
- [Can I Park Here, NYC (Parking.net)](https://www.parking.net/parking-news/Can-I-Park-Here-A-New-Parking-App-For-iPhone-That-Helps-Decipher-Confusing-Parking-Signs-in-NYC-)
- [ParkClear (App Store)](https://apps.apple.com/app/id6746191345)
- [ParkHelp (App Store)](https://apps.apple.com/us/app/parkhelp/id6748860857)
- [ParkBuddy (App Store)](https://apps.apple.com/us/app/id6747955726)
- [Parksy Sign Scanner](https://www.parksy.com/sign-scanner)
- [Pango Sign Scan (Jerusalem Post)](https://www.jpost.com/consumerism/article-847182)
