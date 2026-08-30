/** Shared domain types for the Caravan Route Weather app. */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  label: string;
}

/** A sampled point along the route with its estimated arrival time. */
export interface Waypoint {
  index: number;
  position: LatLng;
  /** Fraction of total route distance covered (0..1). */
  fraction: number;
  /** Estimated arrival epoch milliseconds since departure. */
  etaMs: number;
}

export interface RouteResult {
  geometry: LatLng[];
  /** Total driving duration in seconds. */
  durationSeconds: number;
  /** Total distance in metres. */
  distanceMetres: number;
}

/** Hourly weather conditions at a waypoint, at (or nearest to) its ETA. */
export interface WaypointWeather {
  waypoint: Waypoint;
  time: string; // ISO
  temperatureC: number;
  windSpeedMph: number;
  windGustMph: number;
  precipitationMm: number;
  visibilityM: number;
  weatherCode: number;
  isProjectedBeyondForecast: boolean;
}

export type RiskLevel = 'ok' | 'caution' | 'danger';

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

export interface TripPlan {
  route: RouteResult;
  waypoints: Waypoint[];
  weather: WaypointWeather[];
}
