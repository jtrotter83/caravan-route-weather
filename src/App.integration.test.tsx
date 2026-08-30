import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom cannot host Leaflet canvases reliably — stub the map component.
vi.mock('./components/RouteMap', () => ({
  RouteMap: () => <div data-testid="map-stub" />,
}));

import { App } from './App';
import type { Place } from './types';

const start: Place = { label: 'Birmingham, UK', lat: 52.48, lng: -1.9 };
const destination: Place = { label: 'Manchester, UK', lat: 53.48, lng: -2.24 };

const hourly = (gusts: number[], times: string[]) => ({
  hourly: {
    time: times,
    temperature_2m: times.map(() => 14),
    wind_speed_10m: times.map(() => 12),
    wind_gusts_10m: gusts,
    precipitation: times.map(() => 0),
    visibility: times.map(() => 20000),
    weather_code: times.map(() => 2),
  },
});

const TIMES = [
  '2026-08-30T09:00',
  '2026-08-30T10:00',
  '2026-08-30T11:00',
  '2026-08-30T12:00',
  '2026-08-30T13:00',
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes('nominatim')) {
        const isStart = u.includes('Birmingham');
        return new Response(
          JSON.stringify([
            {
              display_name: isStart ? 'Birmingham, UK' : 'Manchester, UK',
              lat: String(isStart ? start.lat : destination.lat),
              lon: String(isStart ? start.lng : destination.lng),
            },
          ]),
          { status: 200 },
        );
      }
      if (u.includes('router.project-osrm.org')) {
        return new Response(
          JSON.stringify({
            code: 'Ok',
            routes: [{ geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', duration: 7200, distance: 180000 }],
          }),
          { status: 200 },
        );
      }
      if (u.includes('open-meteo')) {
        // One location object per waypoint (3-vertex route geometry)
        return new Response(
          JSON.stringify([1, 2, 3].map(() => hourly([10, 20, 38, 15, 10], TIMES))),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected URL: ${u}`);
    }),
  );
});

describe('App (integration, all external APIs mocked)', () => {
  it('runs the full plan flow: search → select → submit → results', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Pin departure inside the mocked forecast window so the chosen hour
    // slots are deterministic regardless of wall-clock time.
    const departureInput = screen.getByLabelText(/departure/i);
    await user.clear(departureInput);
    await user.type(departureInput, '2026-08-30T09:00');

    expect(screen.getByRole('button', { name: /check route weather/i })).toBeDisabled();

    for (const [label, query, name] of [
      ['Start', 'Birmingham', 'Birmingham, UK'],
      ['Destination', 'Manchester', 'Manchester, UK'],
    ] as const) {
      const inputs = screen.getAllByRole('combobox');
      const input = inputs[label === 'Start' ? 0 : 1];
      await user.type(input, query);
      const option = await screen.findByRole('option', { name });
      await user.click(option);
    }

    const submit = screen.getByRole('button', { name: /check route weather/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    // Summary renders with danger verdict (38 mph gusts in mocked data).
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /high risk/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/180 km/)).toBeInTheDocument();
    expect(screen.getAllByText(/38 mph/).length).toBeGreaterThan(0);
    // Timeline shows waypoints for the 3-vertex route geometry.
    expect(await screen.findAllByRole('listitem')).not.toHaveLength(0);
  });
});
