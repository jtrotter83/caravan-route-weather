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

/** Raw Open-Meteo result as returned by geocoding-api.open-meteo.com. */
export interface OpenMeteoResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
}

/** Map an Open-Meteo result to our Place type. */
export function openMeteoResultToPlace(r: OpenMeteoResult): Place {
  const parts = [r.name, r.admin2, r.admin1, r.country].filter((s): s is string =>
    Boolean(s && s.trim()),
  );
  const label = parts.length > 0 ? parts.join(', ') : 'Unnamed place';
  return { label, lat: r.latitude as number, lng: r.longitude as number };
}

/**
 * Open-Meteo geocoder (CORS open, GB-restricted client-side).
 * Used as the stable last-resort anchor in the fallback chain.
 */
export class OpenMeteoGeocoder implements Geocoder {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  async search(query: string, signal?: AbortSignal): Promise<Place[]> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await this.fetchFn(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OpenMeteo search failed: ${res.status}`);
    const body = (await res.json()) as { results?: OpenMeteoResult[] };
    return (body.results ?? []).filter((r) => r.country_code === 'GB').map(openMeteoResultToPlace);
  }
}

/** True for transient server-side failures worth one retry (HTTP 5xx). */
export function isRetryableError(err: unknown): boolean {
  return err instanceof Error && /\b5\d{2}\b/.test(err.message);
}

/**
 * Wraps a geocoder and retries once on retryable (HTTP 5xx) failures,
 * after a short delay. Aborted requests are never retried.
 */
export class RetryingGeocoder implements Geocoder {
  private readonly inner: Geocoder;
  private readonly delayMs: number;
  private readonly shouldRetry: (err: unknown) => boolean;

  constructor(
    inner: Geocoder,
    {
      delayMs = 300,
      shouldRetry = isRetryableError,
    }: { delayMs?: number; shouldRetry?: (err: unknown) => boolean } = {},
  ) {
    this.inner = inner;
    this.delayMs = delayMs;
    this.shouldRetry = shouldRetry;
  }

  async search(query: string, signal?: AbortSignal): Promise<Place[]> {
    try {
      return await this.inner.search(query, signal);
    } catch (err) {
      if (signal?.aborted || !this.shouldRetry(err)) throw err;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, this.delayMs);
        const onAbort = () => {
          clearTimeout(timer);
          reject(signal?.reason ?? new Error('Aborted'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
      });
      return this.inner.search(query, signal);
    }
  }
}

/** Convenience: wrap a geocoder with a single retry on 5xx. */
export const retrying = (inner: Geocoder, delayMs = 300): Geocoder =>
  new RetryingGeocoder(inner, { delayMs });

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
