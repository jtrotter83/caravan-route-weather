import { describe, expect, it } from 'vitest';
import { OpenMeteoWeatherService, pickHourAtEta } from './weather';
import type { Waypoint } from '../types';

function hourlyResponse(times: number[], gusts: number[]) {
  return {
    hourly: {
      time: times,
      temperature_2m: times.map(() => 15),
      wind_speed_10m: times.map(() => 10),
      wind_gusts_10m: gusts,
      precipitation: times.map(() => 0),
      visibility: times.map(() => 24000),
      weather_code: times.map(() => 1),
    },
  };
}

// Open-Meteo with &timeformat=unixtime returns epoch seconds (UTC-unambiguous).
const T0 = Date.UTC(2026, 7, 30, 9) / 1000;
const HOUR = 3600;
const TIMES = [0, 1, 2, 3].map((h) => T0 + h * HOUR);

describe('pickHourAtEta', () => {
  const waypoint: Waypoint = {
    index: 0,
    position: { lat: 52, lng: -1 },
    fraction: 0,
    etaMs: Date.UTC(2026, 7, 30, 10, 20),
  };

  it('selects the hourly slot closest to the ETA', () => {
    const w = pickHourAtEta(waypoint, hourlyResponse(TIMES, [10, 20, 30, 40]));
    expect(w.time).toBe('2026-08-30T10:00:00.000Z');
    expect(w.windGustMph).toBe(20);
    expect(w.isProjectedBeyondForecast).toBe(false);
  });

  // Regression: with timezone=UTC, Open-Meteo used to return naive local-parsed
  // ISO strings (no Z), shifting slot matching by the local UTC offset (BST = 1h).
  // The whole suite runs with TZ=Europe/London (see package.json) so a relapse
  // to Date.parse of naive strings fails here even though it passes in UTC.
  it('matches ETA to slots correctly under a non-UTC local timezone (BST)', () => {
    const bstWaypoint: Waypoint = {
      ...waypoint,
      // 11:20 local (BST) === 10:20 UTC
      etaMs: Date.parse('2026-08-30T11:20:00+01:00'),
    };
    const w = pickHourAtEta(bstWaypoint, hourlyResponse(TIMES, [10, 20, 30, 40]));
    expect(w.time).toBe('2026-08-30T10:00:00.000Z');
    expect(w.windGustMph).toBe(20);
  });

  it('marks weather beyond the forecast horizon as projected', () => {
    const late = { ...waypoint, etaMs: Date.UTC(2026, 7, 30, 12, 10) };
    const w = pickHourAtEta(late, hourlyResponse(TIMES, [10, 20, 30, 40]));
    expect(w.time).toBe('2026-08-30T12:00:00.000Z');
    expect(w.isProjectedBeyondForecast).toBe(true);
  });
});

describe('OpenMeteoWeatherService', () => {
  it('batches all waypoints into one request with mph wind units', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('latitude=52.0000,53.0000');
      expect(url).toContain('longitude=-1.0000,-2.0000');
      expect(url).toContain('wind_speed_unit=mph');
      expect(url).toContain('timeformat=unixtime');
      return new Response(
        JSON.stringify([hourlyResponse(TIMES, [5, 5, 5, 5]), hourlyResponse(TIMES, [5, 5, 5, 5])]),
        {
          status: 200,
        },
      );
    });
    const svc = new OpenMeteoWeatherService(fetchFn as unknown as typeof fetch);
    const waypoints: Waypoint[] = [
      { index: 0, position: { lat: 52, lng: -1 }, fraction: 0, etaMs: Date.UTC(2026, 7, 30, 10) },
      { index: 1, position: { lat: 53, lng: -2 }, fraction: 1, etaMs: Date.UTC(2026, 7, 30, 11) },
    ];
    const result = await svc.forecastAtEtas(waypoints);
    expect(result).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('handles single-object responses for a lone waypoint', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify(hourlyResponse(TIMES, [1, 2, 3, 4])), { status: 200 }),
    );
    const svc = new OpenMeteoWeatherService(fetchFn as unknown as typeof fetch);
    const result = await svc.forecastAtEtas([
      {
        index: 0,
        position: { lat: 52, lng: -1 },
        fraction: 0,
        etaMs: Date.UTC(2026, 7, 30, 9, 45),
      },
    ]);
    expect(result[0].windGustMph).toBe(2);
  });

  it('throws a clear error when a location response is missing', async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify([{ error: true, reason: 'oops' }]), { status: 200 }),
    );
    const svc = new OpenMeteoWeatherService(fetchFn as unknown as typeof fetch);
    await expect(
      svc.forecastAtEtas([{ index: 0, position: { lat: 52, lng: -1 }, fraction: 0, etaMs: 0 }]),
    ).rejects.toThrow(/missing hourly data for waypoint 0/u);
  });

  it('returns empty for no waypoints without fetching', async () => {
    const fetchFn = vi.fn();
    const svc = new OpenMeteoWeatherService(fetchFn as unknown as typeof fetch);
    expect(await svc.forecastAtEtas([])).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
