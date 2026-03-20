'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';

interface CompassData {
  userLat: number;
  userLon: number;
  userAlt: number | null;
  targetLat: number;
  targetLon: number;
  targetAlt: number | null;
}

const AZIMUTH_MIN_DISTANCE_KM = 0.01; // 10m — below this, azimuth is unstable

/** Fixed-size cross marker using Leaflet DivIcon (always same pixel size regardless of zoom) */
function useCrossMarker(lat: number, lon: number, color: string, map: L.Map) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const icon = L.divIcon({
      className: '',
      html: `<svg width="20" height="20" viewBox="0 0 20 20"><line x1="10" y1="2" x2="10" y2="18" stroke="${color}" stroke-width="2"/><line x1="2" y1="10" x2="18" y2="10" stroke="${color}" stroke-width="2"/><circle cx="10" cy="10" r="3" fill="${color}"/></svg>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const marker = L.marker([lat, lon], { icon, interactive: false }).addTo(map);
    markerRef.current = marker;
    return () => { marker.remove(); };
  }, [lat, lon, color, map]);

  return markerRef;
}

export function CompassOverlay({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const map = useMap();
  const [data, setData] = useState<CompassData | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchGenRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  // Stable deactivate ref to avoid effect re-runs
  const deactivateRef = useRef(onDeactivate);
  deactivateRef.current = onDeactivate;

  // GPS watch — continuous position updates
  useEffect(() => {
    if (!active) {
      setData(null);
      setError(null);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    setLocating(true);
    setError(null);
    let firstFix = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (firstFix) {
          map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 1 });
          firstFix = false;
          setLocating(false);
        }
        const alt = await fetchElevation(latitude, longitude);
        setData((prev) => ({
          userLat: latitude,
          userLon: longitude,
          userAlt: alt != null ? Math.round(alt) : (prev?.userAlt ?? null),
          targetLat: prev?.targetLat ?? map.getCenter().lat,
          targetLon: prev?.targetLon ?? map.getCenter().lng,
          targetAlt: prev?.targetAlt ?? null,
        }));
      },
      (err) => {
        setLocating(false);
        const msg = err.code === 1 ? 'Permesso GPS negato. Abilitalo nelle impostazioni del browser.'
          : err.code === 3 ? 'Timeout GPS. Riprova all\'aperto.'
          : 'Posizione non disponibile.';
        setError(msg);
        setTimeout(() => { deactivateRef.current(); }, 3000);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, map]);

  // Update target position as map moves (real-time)
  useMapEvents({
    move() {
      if (!active || !data) return;
      const center = map.getCenter();
      setData((prev) => prev ? { ...prev, targetLat: center.lat, targetLon: center.lng } : null);
    },
    async moveend() {
      if (!active || !data) return;
      const gen = ++fetchGenRef.current;
      const center = map.getCenter();
      const alt = await fetchElevation(center.lat, center.lng);
      if (gen !== fetchGenRef.current) return; // stale, discard
      setData((prev) => prev ? {
        ...prev,
        targetLat: center.lat,
        targetLon: center.lng,
        targetAlt: alt != null ? Math.round(alt) : null,
      } : null);
    },
  });

  // Render cross markers via Leaflet DivIcon (fixed pixel size)
  useCrossMarker(
    data?.userLat ?? 0, data?.userLon ?? 0,
    '#4ade80', map
  );
  useCrossMarker(
    data?.targetLat ?? 0, data?.targetLon ?? 0,
    '#ef4444', map
  );

  if (!active) return null;

  if (error) {
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/90 rounded-lg px-4 py-2 text-sm text-red-200 max-w-[calc(100%-1rem)] text-center">
        {error}
      </div>
    );
  }

  if (locating) {
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 text-sm text-gray-300">
        Localizzazione in corso...
      </div>
    );
  }

  if (!data) return null;

  const distance = haversineDistance(data.userLat, data.userLon, data.targetLat, data.targetLon);
  const azimuth = distance > AZIMUTH_MIN_DISTANCE_KM
    ? forwardAzimuth(data.userLat, data.userLon, data.targetLat, data.targetLon)
    : null;
  const altDiff = data.targetAlt != null && data.userAlt != null
    ? data.targetAlt - data.userAlt
    : null;

  const distDisplay = distance < 1
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toFixed(2)} km`;

  return (
    <>
      {/* Line between user and target */}
      <Polyline
        positions={[[data.userLat, data.userLon], [data.targetLat, data.targetLon]]}
        color="#facc15"
        weight={2}
        dashArray="6 4"
      />

      {/* Overlay with compass data */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 flex gap-4 items-center text-sm max-w-[calc(100%-1rem)]">
        <div className="text-center">
          <div className="text-amber-400 font-bold text-base">{azimuth != null ? `${azimuth.toFixed(1)}°` : '--'}</div>
          <div className="text-gray-500 text-[10px]">Azimuth</div>
        </div>
        <div className="w-px h-8 bg-gray-700" />
        <div className="text-center">
          <div className="text-green-400 font-bold text-base">{distDisplay}</div>
          <div className="text-gray-500 text-[10px]">Distanza</div>
        </div>
        <div className="w-px h-8 bg-gray-700" />
        <div className="text-center">
          <div className={`font-bold text-base ${altDiff != null ? (altDiff >= 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-500'}`}>
            {altDiff != null ? `${altDiff >= 0 ? '+' : ''}${altDiff} m` : '...'}
          </div>
          <div className="text-gray-500 text-[10px]">Δ Quota</div>
        </div>
      </div>
    </>
  );
}
