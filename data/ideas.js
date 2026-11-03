// ============================================================
//  J&E app ideas — the single source of truth for the tracker.
// ============================================================
//  Edit this file to add ideas, change status, tick off features
//  or add a log entry. The tracker page (index.html) reads it.
//
//  status: "idea" | "exploring" | "building" | "testing" | "live" | "parked"
//  priority: 1 (highest) .. 3
//  features[].done: true/false  -> drives the progress bar
//  log: newest first, { date: "YYYY-MM-DD", who: "Emil" | "Jacob" | "Claude", text }
// ============================================================

window.IDEAS = [
  {
    id: "truck-stops",
    name: "Truck Stop Map & Break Planner",
    status: "building",
    priority: 1,
    owner: "Emil & Jacob",
    app: "apps/truck-stops/",
    summary:
      "Enter a destination and plan the whole truck journey: truck-safe route, live traffic, and where to take mandatory breaks (truck parking, rest areas, restaurants).",
    features: [
      { text: "Map of truck stops, rest areas and truck parking (OpenStreetMap)", done: true },
      { text: "Search a place / use my location", done: true },
      { text: "Break timer: when is my 45 min break due (EU 4.5 h rule)", done: true },
      { text: "Show how far I can drive before the break (range circle)", done: true },
      { text: "Enter destination and get a route", done: false },
      { text: "Suggest break stops along the route", done: false },
      { text: "Truck restrictions: bridge heights, weight, hazmat", done: false },
      { text: "Live traffic (Google Maps or similar)", done: false },
      { text: "Most economical route option (fuel, tolls)", done: false },
      { text: "Restaurants / showers / security info per stop", done: false },
    ],
    openQuestions: [
      "Which routing API supports truck restrictions? (Google Maps doesn't do truck routing well — look at HERE, TomTom, PTV, GraphHopper)",
      "Confirm driving-time rules per region (EU 561/2006 vs. other countries)",
      "Phone app (driver in cab) or also web for dispatchers?",
      "Do we talk to real truck drivers first to see what they actually miss?",
    ],
    nextSteps: [
      "Try the v0 map and write down what feels missing",
      "Pick a truck-routing provider and check prices",
    ],
    log: [
      { date: "2026-11-03", who: "Claude", text: "Built v0: map of truck stops + break timer + range circle." },
      { date: "2026-11-03", who: "Emil & Jacob", text: "Idea discussed in evening session." },
    ],
  },
  {
    id: "car-parking",
    name: "Car Parking Finder",
    status: "building",
    priority: 1,
    owner: "Emil & Jacob",
    app: "apps/car-parking/",
    summary:
      "Smart parking assistant: where am I allowed to park, what is cheapest, and what are the chances of finding a spot near my destination.",
    features: [
      { text: "Map of car parks near a destination (OpenStreetMap)", done: true },
      { text: "Free / paid / unknown colour coding", done: true },
      { text: "Sort by walking distance, show capacity, max stay, opening hours", done: true },
      { text: "Street parking segments where mapped", done: true },
      { text: "Real prices per hour (municipal / operator data)", done: false },
      { text: "Rules: where is parking permitted right now (signs, time limits, zones)", done: false },
      { text: "Probability of finding a spot (time of day, area, history)", done: false },
      { text: "Account for surroundings / buildings (garages, entrances)", done: false },
      { text: "Pay for parking from the app", done: false },
    ],
    openQuestions: [
      "Where do we get prices? (Sweden: municipal open data, EasyPark/Parkster/Aimo?)",
      "How do we estimate the probability of a free spot without sensors? Crowd-sourced? Time-of-day model?",
      "Start with one city first?",
    ],
    nextSteps: [
      "Try the v0 map in a city you know and note what's wrong/missing",
      "Look for open parking data for the first city",
    ],
    log: [
      { date: "2026-11-03", who: "Claude", text: "Built v0: parking map with free/paid filter and distance sorting." },
      { date: "2026-11-03", who: "Emil & Jacob", text: "Idea discussed in evening session." },
    ],
  },
  {
    id: "project-tracker",
    name: "Project Status Tracker",
    status: "live",
    priority: 1,
    owner: "Emil & Jacob",
    app: "./",
    summary:
      "One place to see all our app ideas, their status and progress, and who changed what. (This page!) Replaces the shared iCloud folder idea with a shared Git repo.",
    features: [
      { text: "List all ideas with status and progress", done: true },
      { text: "Filter by status, search", done: true },
      { text: "Features checklist, open questions and log per idea", done: true },
      { text: "Edit ideas directly in the page (no code editing)", done: false },
      { text: "Show who edited what automatically (from Git history)", done: false },
    ],
    openQuestions: ["Is editing a file in the repo OK, or do we want a real backend so both can edit from the phone?"],
    nextSteps: ["Both of us get access to the repo"],
    log: [{ date: "2026-11-03", who: "Claude", text: "Built tracker v0." }],
  },
  {
    id: "mini-store",
    name: "Mini Store for Creators",
    status: "idea",
    priority: 2,
    owner: "",
    app: "",
    summary:
      "\"Linktree, but for your little store.\" A creator writes a short prompt and gets a mini storefront + a link to share with followers. Even for just one product.",
    features: [
      { text: "Prompt → generated store page", done: false },
      { text: "Shareable link", done: false },
      { text: "Checkout / payments", done: false },
      { text: "Print-on-demand T-shirts from uploaded logo", done: false },
      { text: "Connect across the main social platforms", done: false },
    ],
    openQuestions: [
      "How is this different from TikTok Shop, Shopify Starter, Linktree's own shop?",
      "Which five social platforms?",
    ],
    nextSteps: [],
    log: [{ date: "2026-11-03", who: "Emil & Jacob", text: "Idea discussed." }],
  },
  {
    id: "offline-sharing",
    name: "Data Sharing Without Internet",
    status: "exploring",
    priority: 3,
    owner: "",
    app: "",
    summary:
      "Research idea: how could people share data without the internet (Bluetooth, Wi-Fi Direct, mesh networks, local sync)?",
    features: [
      { text: "Research existing tech (mesh, Bluetooth, Wi-Fi Direct, AirDrop-style)", done: false },
      { text: "Find a concrete use case worth building", done: false },
    ],
    openQuestions: ["Who needs this, and for what?"],
    nextSteps: ["Ask AI to summarise the options for offline data sharing"],
    log: [{ date: "2026-11-03", who: "Emil & Jacob", text: "Came up during the collaboration-tool discussion." }],
  },
  {
    id: "collab-tool",
    name: "Our Own Collaboration Tool",
    status: "parked",
    priority: 3,
    owner: "",
    app: "",
    summary:
      "Git-style collaboration where we can see each other's AI work. Parked for now — GitHub (this repo) + the tracker covers it.",
    features: [],
    openQuestions: ["Is there anything GitHub/Notion can't do for us?"],
    nextSteps: [],
    log: [{ date: "2026-11-03", who: "Claude", text: "Parked: using GitHub repo + this tracker instead." }],
  },
  {
    id: "rizz-assistant",
    name: "Dating Chat \"Rizz\" Assistant",
    status: "parked",
    priority: 3,
    owner: "",
    app: "",
    summary:
      "Upload a screenshot of a dating chat (Tinder, Hinge…), pick a style, get a suggested reply. Contested — one of us called it garbage.",
    features: [
      { text: "Screenshot upload + text extraction", done: false },
      { text: "Pick a style", done: false },
      { text: "Suggested replies", done: false },
    ],
    openQuestions: ["Do we actually want to build this? Crowded market."],
    nextSteps: [],
    log: [{ date: "2026-11-03", who: "Emil & Jacob", text: "Discussed; no agreement to build." }],
  },
];
