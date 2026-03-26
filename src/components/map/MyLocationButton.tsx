'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { fetchElevation } from '@/lib/elevation-api';

interface LocationData {
  lat: number;
  lon: number;
  altitude: number | null;
  accuracy: number;
}

export function MyLocationButton({ hidden }: { hidden?: boolean }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleClick = useCallback(() => {
    if (locating) return;

    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata dal browser');
      setTimeout(() => { if (mountedRef.current) setError(null); }, 3000);
      return;
    }

    setLocating(true);
    setError(null);
    setLocation(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!mountedRef.current) return;
        const { latitude, longitude, accuracy } = pos.coords;
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 1 });

        const alt = await fetchElevation(latitude, longitude);
        if (!mountedRef.current) return;
        setLocation({
          lat: latitude,
          lon: longitude,
          altitude: alt != null ? Math.round(alt) : null,
          accuracy: Math.round(accuracy),
        });
        setLocating(false);
      },
      (err) => {
        if (!mountedRef.current) return;
        setLocating(false);
        const msg = err.code === 1
          ? 'Permesso GPS negato'
          : err.code === 3
            ? 'Timeout GPS'
            : 'Posizione non disponibile';
        setError(msg);
        setTimeout(() => { if (mountedRef.current) setError(null); }, 3000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [locating, map]);

  const handleCopy = useCallback(() => {
    if (!location) return;
    const text = `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [location]);

  if (hidden) return null;

  return (
    <>
      {/* GPS button */}
      <button
        onClick={handleClick}
        disabled={locating}
        className={`absolute bottom-28 right-3 z-[1000] w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg transition-colors ${
          locating
            ? 'bg-gray-700 text-gray-400 cursor-wait'
            : 'bg-gray-800/90 text-green-400 hover:bg-gray-700 hover:text-green-300'
        }`}
        aria-label="La mia posizione"
        title="Mostra la mia posizione"
      >
        {locating ? (
          <span className="animate-pulse">...</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        )}
      </button>

      {/* Location info popup */}
      {location && (
        <div aria-live="polite" className="absolute bottom-40 right-3 z-[1000] bg-gray-900/95 border border-gray-600 rounded-lg p-3 shadow-xl max-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-medium">LA MIA POSIZIONE</span>
            <button
              onClick={() => setLocation(null)}
              className="text-gray-500 hover:text-white text-xs leading-none ml-2"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-gray-500">Lat: </span>
              <span className="text-green-400 font-mono">{location.lat.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-gray-500">Lon: </span>
              <span className="text-green-400 font-mono">{location.lon.toFixed(6)}</span>
            </div>
            {location.altitude != null && (
              <div>
                <span className="text-gray-500">Alt: </span>
                <span className="text-green-400 font-mono">{location.altitude} m</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Precisione: </span>
              <span className="text-gray-300">{location.accuracy} m</span>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="mt-2 w-full py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] rounded transition-colors"
            title="Copia coordinate negli appunti"
          >
            Copia coordinate
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div aria-live="assertive" className="absolute bottom-40 right-3 z-[1000] bg-red-900/90 rounded-lg px-3 py-2 text-xs text-red-200 shadow-lg">
          {error}
        </div>
      )}
    </>
  );
}
