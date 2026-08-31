import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlaceInput } from './PlaceInput';
import type { Geocoder } from '../services/geocoding';
import type { Place } from '../types';

const place: Place = { label: 'Pentewan, Cornwall', lat: 50.27, lng: -4.79 };

/** A geocoder whose search rejects with the given error object. */
const rejectingGeocoder = (error: unknown): Geocoder => ({
  search: vi.fn(() => Promise.reject(error)),
});

describe('PlaceInput error handling', () => {
  it('shows no error when the request is aborted with a DOMException AbortError', async () => {
    const user = userEvent.setup();
    const geocoder = rejectingGeocoder(
      Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }),
    );
    render(
      <PlaceInput label="Start" placeholder="Where from?" geocoder={geocoder} onSelect={vi.fn()} />,
    );
    await user.type(screen.getByRole('combobox'), 'Pentewan');
    await waitFor(() => expect(geocoder.search).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText(/user aborted a request/i)).not.toBeInTheDocument(),
    );
    expect(document.querySelector('.error')).toBeNull();
  });

  it('shows no error for a non-DOMException abort-like rejection (cross-realm mobile browser)', async () => {
    const user = userEvent.setup();
    // Plain object, not an Error/DOMException instance — as leaked by some mobile browsers.
    const fakeAbort = { name: 'AbortError', message: 'signal is aborted without reason' };
    const geocoder = rejectingGeocoder(fakeAbort);
    render(
      <PlaceInput label="Start" placeholder="Where from?" geocoder={geocoder} onSelect={vi.fn()} />,
    );
    await user.type(screen.getByRole('combobox'), 'Pentewan');
    await waitFor(() => expect(geocoder.search).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/signal is aborted/i)).not.toBeInTheDocument());
    expect(document.querySelector('.error')).toBeNull();
  });

  it('shows a friendly message on network failure (TypeError Failed to fetch)', async () => {
    const user = userEvent.setup();
    const geocoder = rejectingGeocoder(new TypeError('Failed to fetch'));
    render(
      <PlaceInput label="Start" placeholder="Where from?" geocoder={geocoder} onSelect={vi.fn()} />,
    );
    await user.type(screen.getByRole('combobox'), 'Pentewan');
    await waitFor(
      () => expect(screen.getByText('Search unavailable — check connection')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it('drops stale results when a newer search superseded them (race guard)', async () => {
    const user = userEvent.setup();
    const resolvers: Array<(p: Place[]) => void> = [];
    const geocoder: Geocoder = {
      search: vi.fn(
        () =>
          new Promise<Place[]>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    };
    render(
      <PlaceInput label="Start" placeholder="Where from?" geocoder={geocoder} onSelect={vi.fn()} />,
    );
    const input = screen.getByRole('combobox');
    await user.type(input, 'Pentewa');
    await waitFor(() => expect(geocoder.search).toHaveBeenCalledTimes(1), { timeout: 3000 });
    // Newer burst → second search supersedes the first.
    await user.type(input, 'n');
    await waitFor(() => expect(geocoder.search).toHaveBeenCalledTimes(2), { timeout: 3000 });
    // Stale (first) search resolves last; its results must be dropped.
    resolvers[0]([place]);
    await waitFor(() => expect(document.querySelector('.results')).toBeNull(), { timeout: 2000 });
  });
});
