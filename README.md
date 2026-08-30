# Caravan Route Weather 🚗🌦️

Weather-at-ETA planner for UK caravan trips. Enter a start, destination and
departure time — the app fetches a driving route, samples waypoints along it,
and shows the forecast at each waypoint **weighted by when you'll actually be
there**, with towing-specific warnings (gusts over 35 mph, rain, visibility,
near-freezing temperatures).

## Stack

- React + TypeScript + Vite (static build, GitHub Pages–ready)
- Routing: [OSRM public demo API](https://router.project-osrm.org)
- Geocoding: [Nominatim](https://nominatim.org) (debounced, UK-restricted)
- Weather: [Open-Meteo forecast API](https://open-meteo.com) (free, no key)
- Map: Leaflet + react-leaflet on OpenStreetMap tiles
- No backend — everything runs client-side

## Setup

```bash
npm install
npm run dev        # local dev server
npm test           # unit + integration tests (external APIs fully mocked)
npm run lint       # ESLint
npm run format     # Prettier write (format:check in CI)
npm run build      # typecheck + production build → dist/
npm run smoke      # live-API smoke check of route + weather pipeline
```

## How it works

1. **Plan** — UK place autocomplete (Nominatim, ≥3 chars, 500 ms debounce)
   for start and destination plus a departure date/time.
2. **Route** — OSRM returns polyline geometry, total distance and duration.
3. **Waypoints** — up to 8 evenly spaced points along the route, each with an
   ETA proportional to distance covered (see `src/logic/waypoints.ts`).
4. **Weather** — one batched Open-Meteo call for all waypoint locations; the
   hourly slot closest to each waypoint's ETA is selected (wind in mph).
5. **Assess** — each waypoint is rated ok / caution / danger against towing
   thresholds (`src/logic/risk.ts`); the map shows colour-coded markers and
   the timeline lists conditions and reasons per leg.

## Docs

- [workflows.md](docs/workflows.md) — Mermaid diagrams of app workflows
- [decisions.md](docs/decisions.md) — key logic and architecture decisions

## Known limitations (V1)

- ETA is proportional to distance, not per-step OSRM traffic timing.
- Open-Meteo hourly horizon is ~7 days; later ETAs are flagged as projected.
- OSRM demo server and Nominatim are rate-limited public services.
