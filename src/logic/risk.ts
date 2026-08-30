import type { RiskAssessment, WaypointWeather } from '../types';

/** Towing safety thresholds (see docs/decisions.md). */
export const THRESHOLDS = {
  gustCautionMph: 30,
  gustDangerMph: 35,
  windCautionMph: 25,
  precipitationCautionMm: 1,
  visibilityCautionM: 2000,
  temperatureColdC: 2,
} as const;

/**
 * Assess towing risk for one waypoint. Wind gusts are the primary signal
 * (caravans are prone to instability in crosswinds), then rain, visibility
 * and near-freezing temperatures.
 */
export function assessRisk(w: WaypointWeather): RiskAssessment {
  const reasons: string[] = [];
  let level: RiskAssessment['level'] = 'ok';

  const raise = (newLevel: RiskAssessment['level'], reason: string) => {
    reasons.push(reason);
    if (newLevel === 'danger' || (newLevel === 'caution' && level === 'ok')) {
      level = newLevel;
    }
  };

  if (w.windGustMph > THRESHOLDS.gustDangerMph) {
    raise('danger', `Gusts ${Math.round(w.windGustMph)} mph exceed 35 mph — high risk for towing`);
  } else if (w.windGustMph > THRESHOLDS.gustCautionMph) {
    raise('caution', `Gusts ${Math.round(w.windGustMph)} mph — gusting above 30 mph`);
  }
  if (w.windSpeedMph > THRESHOLDS.windCautionMph) {
    raise('caution', `Sustained wind ${Math.round(w.windSpeedMph)} mph`);
  }
  if (w.precipitationMm > THRESHOLDS.precipitationCautionMm) {
    raise('caution', `Rain ${w.precipitationMm.toFixed(1)} mm/h`);
  }
  if (w.visibilityM < THRESHOLDS.visibilityCautionM) {
    raise('caution', `Visibility ${Math.round(w.visibilityM / 100) / 10} km`);
  }
  if (w.temperatureC <= THRESHOLDS.temperatureColdC) {
    raise('caution', `Near-freezing ${w.temperatureC.toFixed(1)} °C — possible ice`);
  }
  if (w.isProjectedBeyondForecast) {
    raise('caution', 'ETA beyond hourly forecast horizon — conditions estimated');
  }

  return { level, reasons };
}

/** Aggregate risk across the whole trip (worst point wins). */
export function assessTripRisk(weather: WaypointWeather[]): RiskAssessment {
  const order = { ok: 0, caution: 1, danger: 2 } as const;
  let worst: RiskAssessment = { level: 'ok', reasons: [] };
  for (const w of weather) {
    const r = assessRisk(w);
    if (order[r.level] > order[worst.level]) worst = r;
  }
  return worst;
}

/** Colour for map markers / timeline entries. */
export function riskColour(level: RiskAssessment['level']): string {
  switch (level) {
    case 'danger':
      return '#d32f2f';
    case 'caution':
      return '#f9a825';
    default:
      return '#2e7d32';
  }
}

/** Human-readable Open-Meteo WMO weather code summary. */
export function describeWeatherCode(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Icy fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Violent showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm + hail',
    99: 'Thunderstorm + hail',
  };
  return map[code] ?? 'Unknown';
}
