import { useMemo, useState } from 'react';
import type { Place } from './types';
import {
  FallbackGeocoder,
  NominatimGeocoder,
  OpenMeteoGeocoder,
  PhotonGeocoder,
  retrying,
} from './services/geocoding';
import { OsrmRoutingService } from './services/routing';
import { OpenMeteoWeatherService } from './services/weather';
import { defaultDepartureMs, useTripPlanner } from './hooks/useTripPlanner';
import { PlaceInput } from './components/PlaceInput';
import { RouteMap } from './components/RouteMap';
import { LegTimeline } from './components/LegTimeline';
import { TripSummary } from './components/TripSummary';

/** Local datetime input value (en-GB, UTC-agnostic) → epoch ms. */
export function datetimeToMs(value: string): number {
  return new Date(value).getTime();
}

/** Epoch ms → local datetime input value. */
export function msToDatetime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function App() {
  const deps = useMemo(
    () => ({
      routing: new OsrmRoutingService(),
      weather: new OpenMeteoWeatherService(),
      geocoder: new FallbackGeocoder([
        retrying(new PhotonGeocoder()),
        retrying(new NominatimGeocoder()),
        new OpenMeteoGeocoder(),
      ]),
    }),
    [],
  );
  const { status, error, plan, planTrip } = useTripPlanner(deps);

  const [start, setStart] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(msToDatetime(defaultDepartureMs()));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !destination) return;
    void planTrip(start, destination, datetimeToMs(departure));
  };

  return (
    <main className="app">
      <h1>🚗 caravan route weather</h1>
      <p className="tagline">Towing-aware forecasts along your UK driving route</p>

      <form onSubmit={onSubmit} className="planner" aria-label="Plan a trip">
        <PlaceInput
          label="Start"
          placeholder="e.g. Birmingham"
          geocoder={deps.geocoder}
          onSelect={setStart}
        />
        <PlaceInput
          label="Destination"
          placeholder="e.g. Lake District"
          geocoder={deps.geocoder}
          onSelect={setDestination}
        />
        <label>
          Departure
          <input
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!start || !destination || status === 'loading'}>
          {status === 'loading' ? 'Planning…' : 'Check route weather'}
        </button>
      </form>

      {status === 'error' && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {plan && (
        <div className="results">
          <RouteMap plan={plan} start={start} destination={destination} />
          <div className="panels">
            <TripSummary plan={plan} departureMs={datetimeToMs(departure)} />
            <LegTimeline plan={plan} departureMs={datetimeToMs(departure)} />
          </div>
        </div>
      )}
    </main>
  );
}
