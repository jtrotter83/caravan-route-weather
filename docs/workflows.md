# App Workflows

Mermaid diagrams describing the main flows of Caravan Route Weather.

## Trip planning (primary workflow)

```mermaid
flowchart TD
    A[User enters start] -->|≥3 chars, 500ms debounce| B[Nominatim UK search]
    B --> C[User selects place]
    C --> D[User enters destination]
    D -->|same debounce flow| E[User selects place]
    E --> F[User picks departure date/time]
    F --> G[Submit: Check route weather]
    G --> H[OSRM route: geometry + duration + distance]
    H --> I[Sample ≤8 waypoints, ETA ∝ distance fraction]
    I --> J[Open-Meteo batched hourly forecast for all waypoints]
    J --> K[Pick hourly slot nearest each ETA]
    K --> L{Assess towing risk per waypoint}
    L -->|ok 🟢| M[Map marker + timeline green]
    L -->|caution 🟡| N[Warnings: gusts >30mph, rain, visibility, ice, horizon]
    L -->|danger 🔴| O[Gusts >35mph — high risk verdict]
    M --> P[Trip summary: worst point wins]
    N --> P
    O --> P
```

## Error handling

```mermaid
flowchart TD
    A[planTrip] --> B{Route fetch OK?}
    B -- no --> C[Error state: show message, clear plan]
    B -- yes --> D{Weather fetch OK?}
    D -- no --> C
    D -- yes --> E[Results rendered]
    C --> F[User adjusts inputs and retries]
```

## Departure-time comparison (nice-to-have, not in V1)

```mermaid
flowchart LR
    A[Slider: -2h … +2h] --> B[Re-run waypoint ETA + forecast resolution]
    B --> C[Reused cached route + forecast response]
```
