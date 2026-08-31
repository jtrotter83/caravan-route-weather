import { describe, expect, it } from 'vitest';
import {
  FallbackGeocoder,
  NominatimGeocoder,
  PhotonGeocoder,
  debounce,
  photonFeatureToPlace,
  toPlace,
} from './geocoding';
import type { Place } from '../types';
import type { PhotonFeature } from './geocoding';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('NominatimGeocoder', () => {
  it('searches UK-restricted queries and maps results', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('countrycodes=gb');
      expect(url).toContain(encodeURIComponent('Lake District'));
      return jsonResponse([{ display_name: 'Lake District, England', lat: '54.5', lon: '-3.0' }]);
    });
    const geocoder = new NominatimGeocoder(fetchFn as unknown as typeof fetch);
    const places = await geocoder.search('Lake District');
    expect(places).toEqual([{ label: 'Lake District, England', lat: 54.5, lng: -3 }]);
  });

  it('throws on HTTP errors', async () => {
    const geocoder = new NominatimGeocoder(
      (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch,
    );
    await expect(geocoder.search('x')).rejects.toThrow('Nominatim search failed: 500');
  });
});

describe('toPlace', () => {
  it('maps Nominatim fields to a Place', () => {
    expect(toPlace({ display_name: 'Birmingham, UK', lat: '52.48', lon: '-1.9' })).toEqual({
      label: 'Birmingham, UK',
      lat: 52.48,
      lng: -1.9,
    });
  });
});

describe('debounce', () => {
  it('coalesces rapid calls into one', async () => {
    let calls = 0;
    const fn = (v: string) => {
      calls++;
      expect(v).toBe('final');
    };
    const d = debounce(fn, 10);
    d('a');
    d('b');
    d('final');
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(1);
  });

  it('cancel() prevents the invocation', async () => {
    let calls = 0;
    const d = debounce((_x: string) => calls++, 10);
    d('x');
    d.cancel();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(0);
  });
});

function photonFeature(overrides: Partial<PhotonFeature['properties']> = {}): PhotonFeature {
  return {
    geometry: { coordinates: [-1.9, 52.5] },
    properties: {
      name: 'Birmingham',
      city: 'Birmingham',
      country: 'United Kingdom',
      countrycode: 'GB',
      ...overrides,
    },
  };
}

describe('PhotonGeocoder', () => {
  it('queries photon with bbox, limit and lang, and maps results', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('https://photon.komoot.io/api/');
      expect(url).toContain('limit=5');
      expect(url).toContain('lang=en');
      expect(url).toContain('bbox=-8.65,49.86,1.77,60.85');
      expect(url).toContain(encodeURIComponent('Birmingham'));
      return jsonResponse({ features: [photonFeature()] });
    });
    const geocoder = new PhotonGeocoder(fetchFn as unknown as typeof fetch);
    const places = await geocoder.search('Birmingham');
    expect(places).toEqual([
      { label: 'Birmingham, Birmingham, United Kingdom', lat: 52.5, lng: -1.9 },
    ]);
  });

  it('builds labels from name + city/county/state + country', () => {
    const place = photonFeatureToPlace(
      photonFeature({ county: 'West Midlands', state: 'England' }) as Parameters<
        typeof photonFeatureToPlace
      >[0],
    );
    expect(place.label).toBe('Birmingham, Birmingham, West Midlands, England, United Kingdom');
  });

  it('swaps coordinate order from [lng, lat] to {lat, lng}', () => {
    const place = photonFeatureToPlace(photonFeature());
    expect(place.lat).toBe(52.5);
    expect(place.lng).toBe(-1.9);
  });

  it('filters out non-GB results but keeps results without a countrycode', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        features: [
          photonFeature({ countrycode: 'FR', name: 'Paris', country: 'France' }),
          photonFeature(),
          photonFeature({ countrycode: undefined, name: 'Somewhere' }),
        ],
      }),
    );
    const geocoder = new PhotonGeocoder(fetchFn as unknown as typeof fetch);
    const places = await geocoder.search('x');
    expect(places).toHaveLength(2);
    expect(places.map((p) => p.label.startsWith('Birmingham'))).toEqual([true, false]);
  });

  it('throws on HTTP errors', async () => {
    const geocoder = new PhotonGeocoder(
      (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch,
    );
    await expect(geocoder.search('x')).rejects.toThrow('Photon search failed: 403');
  });
});

describe('FallbackGeocoder', () => {
  it('falls back to Nominatim when Photon fails', async () => {
    const places: Place[] = [{ label: 'Birmingham, UK', lat: 52.5, lng: -1.9 }];
    const photon = {
      search: vi.fn(async () => {
        throw new Error('Photon search failed: 403');
      }),
    };
    const nominatim = { search: vi.fn(async () => places) };
    const geocoder = new FallbackGeocoder([photon, nominatim]);
    await expect(geocoder.search('Birmingham')).resolves.toBe(places);
    expect(photon.search).toHaveBeenCalledOnce();
    expect(nominatim.search).toHaveBeenCalledOnce();
  });

  it('does not call later providers when the first succeeds', async () => {
    const places: Place[] = [{ label: 'X', lat: 1, lng: 2 }];
    const photon = { search: vi.fn(async () => places) };
    const nominatim = { search: vi.fn() };
    const geocoder = new FallbackGeocoder([photon, nominatim]);
    await expect(geocoder.search('x')).resolves.toBe(places);
    expect(nominatim.search).not.toHaveBeenCalled();
  });

  it('throws when all providers fail', async () => {
    const geocoder = new FallbackGeocoder([
      { search: vi.fn(async () => Promise.reject(new Error('Photon search failed: 500'))) },
      { search: vi.fn(async () => Promise.reject(new Error('Nominatim search failed: 403'))) },
    ]);
    await expect(geocoder.search('x')).rejects.toThrow('Nominatim search failed: 403');
  });

  it('passes the abort signal through to providers', async () => {
    const controller = new AbortController();
    const photon = { search: vi.fn(async () => []) };
    const geocoder = new FallbackGeocoder([photon]);
    await geocoder.search('x', controller.signal);
    expect(photon.search).toHaveBeenCalledWith('x', controller.signal);
  });

  it('rethrows immediately (no fallback) when the caller aborted', async () => {
    const controller = new AbortController();
    const photon = {
      search: vi.fn(async () => {
        controller.abort();
        throw new DOMException('Aborted', 'AbortError');
      }),
    };
    const nominatim = { search: vi.fn(async () => []) };
    const geocoder = new FallbackGeocoder([photon, nominatim]);
    await expect(geocoder.search('x', controller.signal)).rejects.toThrow('Aborted');
    expect(nominatim.search).not.toHaveBeenCalled();
  });
});
