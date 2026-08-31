import { describe, expect, it } from 'vitest';
import { NominatimGeocoder, OpenMeteoGeocoder, PhotonGeocoder } from './geocoding';
import { OsrmRoutingService } from './routing';
import { OpenMeteoWeatherService } from './weather';

/**
 * Regression guard: constructor default fetchFn must be *bound* to
 * globalThis. An unbound captured `fetch` throws
 * "TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation"
 * in browsers when called detached (this.fetchFn(...)), which the friendly
 * message mapping disguised as "Search unavailable — check connection".
 */
describe('default fetchFn is bound, not raw global fetch', () => {
  const cases: Array<[string, () => object]> = [
    ['PhotonGeocoder', () => new PhotonGeocoder()],
    ['NominatimGeocoder', () => new NominatimGeocoder()],
    ['OpenMeteoGeocoder', () => new OpenMeteoGeocoder()],
    ['OsrmRouter', () => new OsrmRoutingService()],
    ['OpenMeteoWeather', () => new OpenMeteoWeatherService()],
  ];

  it.each(cases)('%s default fetchFn is a bound function', (_name, make) => {
    const fn = (make() as unknown as { fetchFn?: unknown }).fetchFn;
    expect(typeof fn).toBe('function');
    // A bound function reports name "bound <originalName>"; the raw global
    // fetch reports just "fetch".
    expect((fn as { name?: string }).name).toBe('bound fetch');
    expect(fn).not.toBe(globalThis.fetch);
  });
});
