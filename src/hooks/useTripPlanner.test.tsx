import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTripPlanner, formatKm, formatDuration, defaultDepartureMs } from './useTripPlanner';
import type { Place, RouteResult, Waypoint, WaypointWeather } from '../types';
import type { RoutingService } from '../services/routing';
import type { WeatherService } from '../services/weather';

const start: Place = { label: 'Birmingham', lat: 52.48, lng: -1.9 };
const destination: Place = { label: 'Manchester', lat: 53.48, lng: -2.24 };

const route: RouteResult = {
  geometry: [
    { lat: 52.48, lng: -1.9 },
    { lat: 53.48, lng: -2.24 },
  ],
  durationSeconds: 5400,
  distanceMetres: 180000,
};

const makeWeather = (): WaypointWeather[] => [
  {
    waypoint: { index: 0, position: { lat: 52.48, lng: -1.9 }, fraction: 0, etaMs: 0 },
    time: '2026-08-30T10:00',
    temperatureC: 16,
    windSpeedMph: 12,
    windGustMph: 18,
    precipitationMm: 0,
    visibilityM: 24000,
    weatherCode: 1,
    isProjectedBeyondForecast: false,
  },
];

function deps(overrides: Partial<{ routing: RoutingService; weather: WeatherService }> = {}) {
  const routing: RoutingService = {
    route: vi.fn(async () => route),
    ...overrides.routing,
  };
  const weather: WeatherService = {
    forecastAtEtas: vi.fn(async (wps: Waypoint[]) =>
      wps.map((w): WaypointWeather => ({ ...makeWeather()[0], waypoint: w })),
    ),
    ...overrides.weather,
  };
  return { routing, weather };
}

describe('useTripPlanner', () => {
  it('plans a trip end-to-end (route → waypoints → weather)', async () => {
    const d = deps();
    const { result } = renderHook(() => useTripPlanner(d));
    await result.current.planTrip(start, destination, Date.UTC(2026, 7, 30, 9));
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.plan?.route).toEqual(route);
    expect(result.current.plan!.waypoints.length).toBeGreaterThan(0);
    expect(result.current.plan!.weather).toHaveLength(result.current.plan!.waypoints.length);
    expect(result.current.error).toBeNull();
  });

  it('propagates routing failures into an error state', async () => {
    const d = deps({
      routing: { route: vi.fn(async () => Promise.reject(new Error('No route found'))) },
    });
    const { result } = renderHook(() => useTripPlanner(d));
    await result.current.planTrip(start, destination, 0);
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('No route found');
    expect(result.current.plan).toBeNull();
  });

  it('clears previous plan when re-planning fails', async () => {
    let shouldFail = false;
    const d = deps({
      routing: {
        route: vi.fn(async () => {
          if (shouldFail) throw new Error('boom');
          return route;
        }),
      },
    });
    const { result } = renderHook(() => useTripPlanner(d));
    await result.current.planTrip(start, destination, 0);
    await waitFor(() => expect(result.current.status).toBe('done'));
    shouldFail = true;
    void result.current.planTrip(start, destination, 0);
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.plan).toBeNull();
  });
});

describe('formatters', () => {
  it('formats distance and duration', () => {
    expect(formatKm(180000)).toBe('180 km');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(1500)).toBe('25m');
  });

  it('defaults departure to an hour ahead', () => {
    const now = Date.UTC(2026, 7, 30, 9, 0);
    expect(defaultDepartureMs(now)).toBe(now + 3600_000);
  });
});
