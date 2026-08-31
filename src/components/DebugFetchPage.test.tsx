import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DebugFetchPage } from './DebugFetchPage';

describe('DebugFetchPage', () => {
  it('renders and shows results after running probes', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    render(<DebugFetchPage />);
    await userEvent.click(screen.getByRole('button', { name: /run probes/i }));

    expect(await screen.findByText(/photon: done/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
