import { describe, expect, it } from 'vitest';
import { decodePolyline, OsrmRoutingService } from './routing';

// Known-encoded polyline: (38.5, -120.2) (40.7, -120.95) (43.252, -126.453)
const ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('decodePolyline', () => {
  it('decodes a reference polyline correctly', () => {
    const pts = decodePolyline(ENCODED);
    expect(pts).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('returns empty for empty input', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('OsrmRoutingService', () => {
  it('builds the OSRM URL and returns decoded geometry + timing', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('router.project-osrm.org/route/v1/driving/');
      expect(url).toContain('-1.9,52.48;-2.24,53.48');
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [{ geometry: ENCODED, duration: 3600, distance: 100000 }],
        }),
        { status: 200 },
      );
    });
    const svc = new OsrmRoutingService(fetchFn as unknown as typeof fetch);
    const route = await svc.route({ lat: 52.48, lng: -1.9 }, { lat: 53.48, lng: -2.24 });
    expect(route.geometry).toHaveLength(3);
    expect(route.durationSeconds).toBe(3600);
    expect(route.distanceMetres).toBe(100000);
  });

  it('throws when OSRM reports no route', async () => {
    const svc = new OsrmRoutingService(
      (async () =>
        new Response(JSON.stringify({ code: 'NoRoute', routes: [] }), {
          status: 200,
        })) as unknown as typeof fetch,
    );
    await expect(svc.route({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).rejects.toThrow(
      'No route found',
    );
  });
});
