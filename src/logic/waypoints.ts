import type { LatLng, RouteResult, Waypoint } from '../types';

/** Great-circle distance in metres (haversine). */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sample up to `maxWaypoints` evenly spaced points along the route geometry,
 * each with an ETA proportional to cumulative distance (approximates steady
 * progress; OSRM step-level traffic nuance is out of scope for V1).
 */
export function sampleWaypoints(
  route: RouteResult,
  departureMs: number,
  maxWaypoints = 8,
): Waypoint[] {
  const { geometry, durationSeconds } = route;
  if (geometry.length < 2) return [];

  // Cumulative distance at each geometry vertex.
  const cumulative: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMetres(geometry[i - 1], geometry[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [];

  const count = Math.min(maxWaypoints, geometry.length);
  const waypoints: Waypoint[] = [];
  for (let i = 0; i < count; i++) {
    const fraction = i / (count - 1);
    const target = fraction * total;
    // First vertex whose cumulative distance >= target.
    let idx = cumulative.findIndex((d) => d >= target);
    if (idx === -1) idx = cumulative.length - 1;
    waypoints.push({
      index: i,
      position: geometry[idx],
      fraction,
      etaMs: departureMs + Math.round(fraction * durationSeconds * 1000),
    });
  }
  return waypoints;
}
