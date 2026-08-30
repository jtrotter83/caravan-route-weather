import { describe, expect, it } from 'vitest';
import { assessRisk, assessTripRisk, describeWeatherCode, riskColour } from './risk';
import type { WaypointWeather } from '../types';

function weather(overrides: Partial<WaypointWeather> = {}): WaypointWeather {
  return {
    waypoint: { index: 0, position: { lat: 52, lng: -1 }, fraction: 0, etaMs: 0 },
    time: '2026-08-30T10:00',
    temperatureC: 15,
    windSpeedMph: 10,
    windGustMph: 15,
    precipitationMm: 0,
    visibilityM: 24000,
    weatherCode: 1,
    isProjectedBeyondForecast: false,
    ...overrides,
  };
}

describe('assessRisk', () => {
  it('rates calm dry conditions as ok', () => {
    const r = assessRisk(weather());
    expect(r.level).toBe('ok');
    expect(r.reasons).toEqual([]);
  });

  it('flags gusts over 35 mph as danger', () => {
    const r = assessRisk(weather({ windGustMph: 42 }));
    expect(r.level).toBe('danger');
    expect(r.reasons.join(' ')).toContain('35 mph');
  });

  it('flags gusts 30–35 mph as caution', () => {
    expect(assessRisk(weather({ windGustMph: 32 })).level).toBe('caution');
  });

  it('flags gusts exactly at 35 mph as caution (threshold is strictly greater)', () => {
    expect(assessRisk(weather({ windGustMph: 35 })).level).toBe('caution');
  });

  it('flags heavy rain, poor visibility and near-freezing temperatures', () => {
    const r = assessRisk(weather({ precipitationMm: 2.5, visibilityM: 800, temperatureC: 0.5 }));
    expect(r.level).toBe('caution');
    expect(r.reasons).toHaveLength(3);
  });

  it('notes forecast-horizon extrapolation', () => {
    const r = assessRisk(weather({ isProjectedBeyondForecast: true }));
    expect(r.level).toBe('caution');
    expect(r.reasons.join(' ')).toContain('forecast horizon');
  });
});

describe('assessTripRisk', () => {
  it('escalates to the worst waypoint', () => {
    const r = assessTripRisk([weather(), weather({ windGustMph: 40 }), weather()]);
    expect(r.level).toBe('danger');
  });

  it('is ok when all waypoints are ok', () => {
    expect(assessTripRisk([weather(), weather()]).level).toBe('ok');
  });
});

describe('riskColour', () => {
  it('maps levels to distinct colours', () => {
    const colours = (['ok', 'caution', 'danger'] as const).map(riskColour);
    expect(new Set(colours).size).toBe(3);
  });
});

describe('describeWeatherCode', () => {
  it('describes common codes', () => {
    expect(describeWeatherCode(0)).toBe('Clear');
    expect(describeWeatherCode(63)).toBe('Rain');
    expect(describeWeatherCode(95)).toBe('Thunderstorm');
  });

  it('falls back for unknown codes', () => {
    expect(describeWeatherCode(1234)).toBe('Unknown');
  });
});
