import { describe, expect, it } from 'vitest';
import { haversineMetres, sampleWaypoints } from './waypoints';
import type { RouteResult } from '../types';

const route: RouteResult = {
  // 10-vertex geometry London -> Manchester so waypoints can be sampled finely
  geometry: Array.from({ length: 10 }, (_, i) => ({
    lat: 51.5074 + (53.4808 - 51.5074) * (i / 9),
    lng: -0.1278 + (-2.2426 - -0.1278) * (i / 9),
  })),
  durationSeconds: 14400, // 4h
  distanceMetres: 260000,
};

describe('haversineMetres', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineMetres({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBeLessThan(1);
  });

  it('measures a known distance (London–Paris ≈ 344 km)', () => {
    const d = haversineMetres({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(d).toBeGreaterThan(330_000);
    expect(d).toBeLessThan(360_000);
  });
});

describe('sampleWaypoints', () => {
  const departure = Date.UTC(2026, 7, 30, 9, 0);

  it('returns first and last geometry-influenced points at 0 and full duration', () => {
    const wps = sampleWaypoints(route, departure, 5);
    expect(wps).toHaveLength(5);
    expect(wps[0].fraction).toBe(0);
    expect(wps[0].etaMs).toBe(departure);
    expect(wps.at(-1)!.fraction).toBeCloseTo(1, 5);
    expect(wps.at(-1)!.etaMs).toBe(departure + route.durationSeconds * 1000);
  });

  it('has monotonically increasing ETAs and fractions', () => {
    const wps = sampleWaypoints(route, departure, 8);
    for (let i = 1; i < wps.length; i++) {
      expect(wps[i].fraction).toBeGreaterThan(wps[i - 1].fraction);
      expect(wps[i].etaMs).toBeGreaterThan(wps[i - 1].etaMs);
    }
  });

  it('interpolates ETA proportionally to distance', () => {
    const wps = sampleWaypoints(route, departure, 3);
    // midpoint fraction 0.5 -> half the duration after departure
    expect(wps[1].etaMs).toBe(departure + (route.durationSeconds * 1000) / 2);
  });

  it('caps waypoint count at geometry length', () => {
    expect(sampleWaypoints(route, departure, 20)).toHaveLength(10);
  });

  it('returns empty for degenerate geometry', () => {
    expect(sampleWaypoints({ ...route, geometry: [{ lat: 1, lng: 1 }] }, departure)).toEqual([]);
  });
});
