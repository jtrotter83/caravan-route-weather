import { describe, expect, it } from 'vitest';
import { toPlace, debounce } from './geocoding';

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
