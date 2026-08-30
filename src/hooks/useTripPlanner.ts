import { useCallback, useState } from 'react';
import type { Place, TripPlan } from '../types';
import { sampleWaypoints } from '../logic/waypoints';
import type { RoutingService } from '../services/routing';
import type { WeatherService } from '../services/weather';

export interface TripPlannerDeps {
  routing: RoutingService;
  weather: WeatherService;
}

export type PlannerStatus = 'idle' | 'loading' | 'done' | 'error';

export function useTripPlanner({ routing, weather }: TripPlannerDeps) {
  const [status, setStatus] = useState<PlannerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<TripPlan | null>(null);

  const planTrip = useCallback(
    async (start: Place, destination: Place, departureMs: number, signal?: AbortSignal) => {
      setStatus('loading');
      setError(null);
      try {
        const route = await routing.route(start, destination, signal);
        const waypoints = sampleWaypoints(route, departureMs);
        const forecast = await weather.forecastAtEtas(waypoints, signal);
        setPlan({ route, waypoints, weather: forecast });
        setStatus('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setStatus('error');
        setPlan(null);
      }
    },
    [routing, weather],
  );

  return { status, error, plan, planTrip };
}

/** Format a UTC ISO hour slot as UK-local time, e.g. "14:00". */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format metres as km with one decimal. */
export function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(0)} km`;
}

/** Format driving duration in seconds as "Xh Ym". */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Format a datetime input value for display. */
export function formatDeparture(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Default departure: next round hour + 1h. */
export function defaultDepartureMs(now = Date.now()): number {
  return now + 60 * 60 * 1000;
}
