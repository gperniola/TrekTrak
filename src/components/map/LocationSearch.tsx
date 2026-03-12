'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { searchLocation, type GeocodingResult } from '@/lib/geocoding-api';

const LISTBOX_ID = 'location-search-listbox';
const DEBOUNCE_MS = 400;

export function LocationSearch() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const generationRef = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Prevent Leaflet from receiving native events through this overlay
  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  // Debounced search with cancellation
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Cancel previous in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const generation = ++generationRef.current;

      setLoading(true);
      const data = await searchLocation(query, abortRef.current.signal);

      // Discard stale results if a newer search was triggered
      if (generationRef.current !== generation) return;

      setLoading(false);
      setSearched(true);
      setResults(data);
      setOpen(true);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on click outside (only when open)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      generationRef.current++;
    };
  }, []);

  const selectResult = useCallback((result: GeocodingResult) => {
    map.stop(); // Cancel any in-progress animation (e.g. geolocation flyTo)
    if (result.boundingbox) {
      const [south, north, west, east] = result.boundingbox;
      map.fitBounds([[south, west], [north, east]], { padding: [20, 20], maxZoom: 16, animate: true });
    } else {
      map.flyTo([result.lat, result.lon], 14, { duration: 1.5 });
    }
    setQuery('');
    setResults([]);
    setSearched(false);
    close();
  }, [map, close]);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const option = listRef.current.children[activeIndex] as HTMLElement | undefined;
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        selectResult(results[activeIndex]);
      }
    }
  };

  const showNoResults = open && results.length === 0 && searched && !loading;

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-[1001] w-72 max-w-[calc(100%-1.5rem)]"
    >
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
          &#128269;
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Cerca località..."
          role="combobox"
          aria-label="Cerca località sulla mappa"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={LISTBOX_ID}
          aria-activedescendant={activeIndex >= 0 ? `location-option-${activeIndex}` : undefined}
          className="w-full bg-gray-800/95 border border-gray-600 rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id={LISTBOX_ID}
          className="mt-1 bg-gray-800/95 border border-gray-600 rounded max-h-48 overflow-y-auto"
          role="listbox"
        >
          {results.map((result, i) => (
            <li
              key={`${i}-${result.lat},${result.lon}`}
              id={`location-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-700 last:border-b-0 ${
                i === activeIndex ? 'bg-gray-700 text-green-400' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onMouseDown={() => selectResult(result)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="truncate">{result.displayName}</div>
            </li>
          ))}
        </ul>
      )}

      {showNoResults && (
        <div className="mt-1 bg-gray-800/95 border border-gray-600 rounded px-3 py-2 text-sm text-gray-400">
          Nessun risultato
        </div>
      )}
    </div>
  );
}
