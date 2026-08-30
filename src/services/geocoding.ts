import type { Place } from '../types';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

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
