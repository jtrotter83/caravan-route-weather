import type { Place } from '../types';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const PHOTON_BASE = 'https://photon.komoot.io/api';
/** UK-ish bounding box (minLon, minLat, maxLon, maxLat). */
const UK_BBOX = '-8.65,49.86,1.77,60.85';

export interface Geocoder {
  /** Search UK places by free text. Implementations must debounce caller-side. */
  search(query: string, signal?: AbortSignal): Promise<Place[]>;
}

/** Map a Nominatim result to our Place type. */
export function toPlace(r: { display_name: string; lat: string; lon: string }): Place {
  return { label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) };
}

/**
 * Nominatim-backed geocoder restricted to the UK (countrycodes=gb).
 * Usage policy: debounced by callers, one request per user keystroke burst.
 */
export class NominatimGeocoder implements Geocoder {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  async search(query: string, signal?: AbortSignal): Promise<Place[]> {
    const url = `${NOMINATIM_BASE}/search?format=json&limit=5&countrycodes=gb&q=${encodeURIComponent(query)}`;
    const res = await this.fetchFn(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
    return (await res.json()).map(toPlace);
  }
}

/** Raw Photon feature as returned by photon.komoot.io. */
export interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    postcode?: string;
    street?: string;
    housenumber?: string;
    [k: string]: unknown;
  };
}

/**
 * Build a human-readable label from Photon properties:
 * name, then locality parts, then country.
 */
export function photonFeatureToPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const parts = [
    p.name,
    [p.street, p.housenumber !== undefined ? p.housenumber : undefined]
      .filter(Boolean)
      .join(' ')
      .trim() || undefined,
    p.city,
    p.county,
    p.state,
    p.postcode,
    p.country,
  ].filter((s): s is string => Boolean(s && s.trim()));
  const label = parts.length > 0 ? parts.join(', ') : 'Unnamed place';
  const [lng, lat] = f.geometry.coordinates; // Photon is [lng, lat]
  return { label, lat, lng };
}

/**
 * Photon (komoot) geocoder biased to the UK via a bounding box.
 * CORS-friendly and tolerant of bursty autocomplete traffic.
 */
export class PhotonGeocoder implements Geocoder {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  async search(query: string, signal?: AbortSignal): Promise<Place[]> {
    const url = `${PHOTON_BASE}/?limit=5&lang=en&q=${encodeURIComponent(query)}&bbox=${UK_BBOX}`;
    const res = await this.fetchFn(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Photon search failed: ${res.status}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    return (body.features ?? [])
      .filter((f) => f.properties.countrycode === undefined || f.properties.countrycode === 'GB')
      .map(photonFeatureToPlace);
  }
}

/**
 * Tries providers in order; the first provider that returns wins.
 * If a provider fails (network or HTTP error) the next one is tried;
 * if all fail, the last error is rethrown so the UI shows its friendly message.
 */
export class FallbackGeocoder implements Geocoder {
  private readonly providers: readonly Geocoder[];

  constructor(providers: readonly Geocoder[]) {
    if (providers.length === 0) throw new Error('FallbackGeocoder needs at least one provider');
    this.providers = providers;
  }

  async search(query: string, signal?: AbortSignal): Promise<Place[]> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await provider.search(query, signal);
      } catch (err) {
        if (signal?.aborted) throw err; // don't retry if caller aborted
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All geocoding providers failed');
  }
}

/** Debounce helper (used by the search UI to respect the usage policy). */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return wrapped;
}
