#!/usr/bin/env node
/**
 * Smoke check: verifies route + weather fetch logic against the LIVE
 * OSRM and Open-Meteo APIs. Separate from unit tests (never run in CI).
 * Usage: npm run smoke
 */
import { sampleWaypoints } from '../src/logic/waypoints.ts';
import { OpenMeteoWeatherService } from '../src/services/weather.ts';
import { OsrmRoutingService } from '../src/services/routing.ts';

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

// Birmingham -> Manchester
const start = { lat: 52.4862, lng: -1.8904 };
const end = { lat: 53.4808, lng: -2.2426 };

console.log('1. OSRM route (live)…');
const routing = new OsrmRoutingService();
const route = await routing.route(start, end);
if (route.geometry.length < 10) fail(`route geometry too short: ${route.geometry.length}`);
if (route.durationSeconds < 600) fail(`implausible duration: ${route.durationSeconds}s`);
console.log(
  `  ✓ ${(route.distanceMetres / 1000).toFixed(0)} km, ${(route.durationSeconds / 60).toFixed(0)} min, ${route.geometry.length} vertices`,
);

console.log('2. Waypoint sampling…');
const departure = Date.now() + 3600_000;
const waypoints = sampleWaypoints(route, departure, 8);
if (waypoints.length !== 8) fail(`expected 8 waypoints, got ${waypoints.length}`);
console.log(
  `  ✓ ${waypoints.length} waypoints, last ETA +${Math.round((waypoints.at(-1).etaMs - departure) / 60000)} min`,
);

console.log('3. Open-Meteo batched forecast (live)…');
const weather = new OpenMeteoWeatherService();
const forecast = await weather.forecastAtEtas(waypoints);
for (const w of forecast) {
  if (!Number.isFinite(w.windGustMph)) fail(`non-finite gusts at waypoint ${w.waypoint.index}`);
}
console.log('  ✓ forecast resolved at every waypoint:');
for (const w of forecast) {
  console.log(
    `    wp${w.waypoint.index + 1}: ${w.time} ${w.temperatureC.toFixed(1)}°C wind ${Math.round(w.windSpeedMph)}/g${Math.round(w.windGustMph)} mph rain ${w.precipitationMm}mm`,
  );
}
console.log('✓ Smoke check passed (route + weather pipeline works against live APIs)');
