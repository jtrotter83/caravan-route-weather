import type { Waypoint, WaypointWeather } from '../types';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_VARS = [
  'temperature_2m',
  'wind_speed_10m',
  'wind_gusts_10m',
  'precipitation',
  'visibility',
  'weather_code',
] as const;

/** Milliseconds tolerance when matching ETA to an hourly slot. */
const MATCH_TOLERANCE_MS = 30 * 60 * 1000;

export interface WeatherService {
  /**
   * Fetch hourly forecasts at all waypoint positions in one batched call and
   * resolve conditions at each waypoint's ETA.
   */
  forecastAtEtas(waypoints: Waypoint[], signal?: AbortSignal): Promise<WaypointWeather[]>;
}

interface OpenMeteoLocationResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    precipitation: number[];
    visibility: number[];
    weather_code: number[];
  };
}

export class OpenMeteoWeatherService implements WeatherService {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  async forecastAtEtas(waypoints: Waypoint[], signal?: AbortSignal): Promise<WaypointWeather[]> {
    if (waypoints.length === 0) return [];

    const lat = waypoints.map((w) => w.position.lat.toFixed(4)).join(',');
    const lng = waypoints.map((w) => w.position.lng.toFixed(4)).join(',');
    const url =
      `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}` +
      `&hourly=${HOURLY_VARS.join(',')}&wind_speed_unit=mph&forecast_days=7&timezone=UTC`;

    const res = await this.fetchFn(url, { signal });
    if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
    const raw = await res.json();
    // Open-Meteo returns an array when multiple coordinates are requested,
    // a single object otherwise.
    const locations: OpenMeteoLocationResponse[] = Array.isArray(raw) ? raw : [raw];

    return waypoints.map((waypoint, i) => pickHourAtEta(waypoint, locations[i]));
  }
}

/** Pick the hourly slot closest in time to the waypoint ETA. */
export function pickHourAtEta(
  waypoint: Waypoint,
  location: OpenMeteoLocationResponse,
): WaypointWeather {
  const { time } = location.hourly;
  const eta = waypoint.etaMs;
  const lastSlot = Date.parse(time[time.length - 1]);

  let bestIdx = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < time.length; i++) {
    const delta = Math.abs(Date.parse(time[i]) - eta);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }

  return {
    waypoint,
    time: time[bestIdx],
    temperatureC: location.hourly.temperature_2m[bestIdx],
    windSpeedMph: location.hourly.wind_speed_10m[bestIdx],
    windGustMph: location.hourly.wind_gusts_10m[bestIdx],
    precipitationMm: location.hourly.precipitation[bestIdx],
    visibilityM: location.hourly.visibility[bestIdx],
    weatherCode: location.hourly.weather_code[bestIdx],
    // ETA is beyond (or nearly beyond) the hourly forecast horizon.
    isProjectedBeyondForecast: eta > lastSlot - MATCH_TOLERANCE_MS,
  };
}
