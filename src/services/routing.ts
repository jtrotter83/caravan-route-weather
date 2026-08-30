import type { LatLng, RouteResult } from '../types';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/** Decode an OSRM-encoded polyline (precision 5) into LatLng[]. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export interface RoutingService {
  route(start: LatLng, end: LatLng, signal?: AbortSignal): Promise<RouteResult>;
}

/** OSRM public demo API routing service. */
export class OsrmRoutingService implements RoutingService {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  async route(start: LatLng, end: LatLng, signal?: AbortSignal): Promise<RouteResult> {
    const url = `${OSRM_BASE}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=simplified&geometries=polyline`;
    const res = await this.fetchFn(url, { signal });
    if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);
    const data = (await res.json()) as {
      code: string;
      routes?: { geometry: string; duration: number; distance: number }[];
    };
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`No route found (OSRM code: ${data.code})`);
    }
    const r = data.routes[0];
    return {
      geometry: decodePolyline(r.geometry),
      durationSeconds: r.duration,
      distanceMetres: r.distance,
    };
  }
}
