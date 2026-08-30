import { useEffect, useRef, useState } from 'react';
import type { Place } from '../types';
import { debounce, type Geocoder } from '../services/geocoding';

interface Props {
  label: string;
  placeholder: string;
  geocoder: Geocoder;
  onSelect: (place: Place) => void;
}

/** UK place autocomplete field backed by Nominatim (debounced). */
export function PlaceInput({ label, placeholder, geocoder, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Place | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useRef(
    debounce(async (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const places = await geocoder.search(q, controller.signal);
        setResults(places);
        setError(null);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setError(e instanceof Error ? e.message : 'Search failed');
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 500),
  ).current;

  useEffect(() => () => runSearch.cancel(), [runSearch]);

  const onChange = (value: string) => {
    setQuery(value);
    setChosen(null);
    if (value.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void runSearch(value.trim());
  };

  const choose = (place: Place) => {
    setChosen(place);
    setQuery(place.label);
    setResults([]);
    onSelect(place);
  };

  return (
    <div className="place-input" role="group" aria-label={label}>
      <label>
        {label}
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          role="combobox"
          aria-expanded={results.length > 0}
        />
      </label>
      {chosen && (
        <p className="chosen" data-testid={`${label}-chosen`}>
          ✓ {chosen.label}
        </p>
      )}
      {loading && <p className="hint">Searching…</p>}
      {error && <p className="error">{error}</p>}
      {results.length > 0 && (
        <ul className="results" role="listbox">
          {results.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button type="button" role="option" aria-selected={false} onClick={() => choose(p)}>
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
