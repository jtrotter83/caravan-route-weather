import { describe, expect, it } from 'vitest';
import { NominatimGeocoder } from './geocoding';

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
