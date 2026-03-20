'use client';

import { useEffect, useState } from 'react';
import { useMap, useMapEvents, Polyline, CircleMarker } from 'react-leaflet';
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

function CrossMarker({ lat, lon, color, size = 12 }: { lat: number; lon: number; color: string; size?: number }) {
  // A cross made of two short polylines
  const offset = size / 100000; // ~degrees offset for the cross arms
  return (
    <>
      <Polyline positions={[[lat - offset, lon], [lat + offset, lon]]} color={color} weight={2} />
      <Polyline positions={[[lat, lon - offset * 1.5], [lat, lon + offset * 1.5]]} color={color} weight={2} />
      <CircleMarker center={[lat, lon]} radius={2} color={color} fillColor={color} fillOpacity={1} />
    </>
  );
}

export function CompassOverlay({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const map = useMap();
  const [data, setData] = useState<CompassData | null>(null);
  const [locating, setLocating] = useState(false);

  // Get user position when activated
  useEffect(() => {
    if (!active) {
      setData(null);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 1 });

        // Fetch altitude for user position
        const alt = await fetchElevation(latitude, longitude);

        const center = map.getCenter();
        setData({
          userLat: latitude,
          userLon: longitude,
          userAlt: alt != null ? Math.round(alt) : null,
          targetLat: center.lat,
          targetLon: center.lng,
          targetAlt: null,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Impossibile ottenere la posizione GPS.');
        onDeactivate();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [active, map, onDeactivate]);

  // Update target position as map moves
  useMapEvents({
    move() {
      if (!active || !data) return;
      const center = map.getCenter();
      setData((prev) => prev ? { ...prev, targetLat: center.lat, targetLon: center.lng } : null);
    },
    async moveend() {
      if (!active || !data) return;
      const center = map.getCenter();
      const alt = await fetchElevation(center.lat, center.lng);
      setData((prev) => prev ? {
        ...prev,
        targetLat: center.lat,
        targetLon: center.lng,
        targetAlt: alt != null ? Math.round(alt) : null,
      } : null);
    },
  });

  if (!active) return null;

  if (locating) {
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 text-sm text-gray-300">
        Localizzazione in corso...
      </div>
    );
  }

  if (!data) return null;

  const distance = haversineDistance(data.userLat, data.userLon, data.targetLat, data.targetLon);
  const azimuth = distance > 0.001
    ? forwardAzimuth(data.userLat, data.userLon, data.targetLat, data.targetLon)
    : 0;
  const altDiff = data.targetAlt != null && data.userAlt != null
    ? data.targetAlt - data.userAlt
    : null;

  const distDisplay = distance < 1
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toFixed(2)} km`;

  return (
    <>
      {/* User position cross (green) */}
      <CrossMarker lat={data.userLat} lon={data.userLon} color="#4ade80" size={15} />

      {/* Target cross (red) at map center */}
      <CrossMarker lat={data.targetLat} lon={data.targetLon} color="#ef4444" size={12} />

      {/* Line between user and target */}
      <Polyline
        positions={[[data.userLat, data.userLon], [data.targetLat, data.targetLon]]}
        color="#facc15"
        weight={2}
        dashArray="6 4"
      />

      {/* Overlay with compass data */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 flex gap-4 items-center text-sm">
        <div className="text-center">
          <div className="text-amber-400 font-bold text-base">{azimuth.toFixed(1)}°</div>
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
