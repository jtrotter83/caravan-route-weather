import { useState } from 'react';

/**
 * Temporary diagnostics page (hash route: #/debug).
 * Not linked from the main UI. Shows raw fetch behaviour for the
 * geocoding/weather APIs so mobile browser-side failures can be inspected.
 */

interface ProbeResult {
  label: string;
  state: 'pending' | 'done' | 'failed';
  status?: number;
  bytes?: number;
  preview?: string;
  errCtor?: string;
  errName?: string;
  errMsg?: string;
  ms?: number;
}

const TARGETS: Array<{ label: string; url: string }> = [
  { label: 'photon', url: 'https://photon.komoot.io/api/?limit=1&lang=en&q=Pentewan' },
  {
    label: 'nominatim',
    url: 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=Pentewan',
  },
  {
    label: 'open-meteo',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=50.3&longitude=-4.8&current_weather=true',
  },
  { label: 'same-origin /index.html', url: 'index.html' },
];

async function runProbe(label: string, url: string, set: (r: ProbeResult) => void): Promise<void> {
  set({ label, state: 'pending' });
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json,text/html,*/*' } });
    const text = await res.text();
    set({
      label,
      state: res.ok ? 'done' : 'failed',
      status: res.status,
      bytes: text.length,
      preview: text.slice(0, 100),
      ms: Math.round(performance.now() - t0),
    });
  } catch (e) {
    const err = e as Error;
    set({
      label,
      state: 'failed',
      errCtor: err?.constructor?.name ?? 'unknown',
      errName: err?.name ?? 'unknown',
      errMsg: err?.message ?? String(e),
      ms: Math.round(performance.now() - t0),
    });
  }
}

export function DebugFetchPage() {
  const [results, setResults] = useState<ProbeResult[]>(
    TARGETS.map((t) => ({ label: t.label, state: 'pending' as const })),
  );
  const [started, setStarted] = useState(false);

  const run = () => {
    setStarted(true);
    TARGETS.forEach((t, i) => {
      void runProbe(t.label, t.url, (r) =>
        setResults((prev) => prev.map((p, j) => (j === i ? r : p))),
      );
    });
  };

  const line = (r: ProbeResult): string => {
    const head = `${r.label}: ${r.state}${r.ms !== undefined ? ` (${r.ms}ms)` : ''}`;
    if (r.state === 'done') {
      return `${head}\n  status=${r.status} bytes=${r.bytes}\n  body[0..100]=${r.preview}`;
    }
    if (r.state === 'failed') {
      return [
        head,
        `  ctor=${r.errCtor} name=${r.errName}`,
        `  message=${r.errMsg}`,
        `  onLine=${navigator.onLine}`,
        ...(r.status !== undefined ? [`  status=${r.status} bytes=${r.bytes}`] : []),
        ...(r.preview !== undefined ? [`  body[0..100]=${r.preview}`] : []),
      ].join('\n');
    }
    return `${head} …`;
  };

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '18px', padding: '16px' }}>
      <h1>Fetch diagnostics</h1>
      <p>
        onLine={String(navigator.onLine)} ua={navigator.userAgent.slice(0, 120)}
      </p>
      <button onClick={run} style={{ fontSize: '20px', padding: '12px 24px' }}>
        Run probes
      </button>
      {started && (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '18px' }}>
          {results.map((r) => line(r)).join('\n\n')}
        </pre>
      )}
    </div>
  );
}
