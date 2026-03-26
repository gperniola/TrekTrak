'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapEvents, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { haversineDistance, forwardAzimuth, azimuthToCardinal } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';

interface RulerPoint {
  lat: number;
  lon: number;
  alt: number | null;
}

const markerA = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#4ade80;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;">A</div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const markerB = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">B</div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function RulerTool({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const [pointA, setPointA] = useState<RulerPoint | null>(null);
  const [pointB, setPointB] = useState<RulerPoint | null>(null);
  const clickCountRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset when deactivated
  useEffect(() => {
    if (!active) {
      setPointA(null);
      setPointB(null);
      clickCountRef.current = 0;
    }
  }, [active]);

  // Escape key deactivates
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDeactivate();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, onDeactivate]);

  const handleClick = useCallback(async (e: L.LeafletMouseEvent) => {
    if (!active) return;
    const { lat, lng } = e.latlng;
    const count = clickCountRef.current;

    if (count === 0) {
      setPointA({ lat, lon: lng, alt: null });
      setPointB(null);
      clickCountRef.current = 1;
      const alt = await fetchElevation(lat, lng);
      if (mountedRef.current) setPointA((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    } else if (count === 1) {
      setPointB({ lat, lon: lng, alt: null });
      clickCountRef.current = 2;
      const alt = await fetchElevation(lat, lng);
      if (mountedRef.current) setPointB((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    } else {
      setPointA({ lat, lon: lng, alt: null });
      setPointB(null);
      clickCountRef.current = 1;
      const alt = await fetchElevation(lat, lng);
      if (mountedRef.current) setPointA((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    }
  }, [active]);

  useMapEvents({
    click: handleClick,
  });

  if (!active) return null;

  const distance = pointA && pointB ? haversineDistance(pointA.lat, pointA.lon, pointB.lat, pointB.lon) : null;
  const azimuth = pointA && pointB && distance != null && distance > 0.01
    ? forwardAzimuth(pointA.lat, pointA.lon, pointB.lat, pointB.lon)
    : null;
  const altDiff = pointA?.alt != null && pointB?.alt != null ? pointB.alt - pointA.alt : null;

  const distDisplay = distance != null
    ? (distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(2)} km`)
    : null;

  return (
    <>
      {pointA && (
        <Marker position={[pointA.lat, pointA.lon]} icon={markerA} interactive={false} />
      )}
      {pointB && (
        <Marker position={[pointB.lat, pointB.lon]} icon={markerB} interactive={false} />
      )}
      {pointA && pointB && (
        <Polyline
          positions={[[pointA.lat, pointA.lon], [pointB.lat, pointB.lon]]}
          color="#facc15"
          weight={2}
          dashArray="6 4"
        />
      )}
      {pointA && pointB && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 flex gap-4 items-center text-sm max-w-[calc(100%-1rem)]">
          <div className="text-center">
            <div className="text-blue-400 font-bold text-base">{distDisplay ?? '--'}</div>
            <div className="text-gray-500 text-[10px]">Distanza</div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <div className="text-blue-400 font-bold text-base">
              {azimuth != null ? `${azimuth.toFixed(1)}° ${azimuthToCardinal(azimuth)}` : '--'}
            </div>
            <div className="text-gray-500 text-[10px]">Azimuth</div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <div className={`font-bold text-base ${altDiff != null ? (altDiff >= 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-500'}`}>
              {altDiff != null ? `${altDiff >= 0 ? '+' : ''}${altDiff} m` : '...'}
            </div>
            <div className="text-gray-500 text-[10px]">Δ Quota</div>
          </div>
        </div>
      )}
      {pointA && !pointB && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 text-sm text-gray-300">
          Clicca il secondo punto
        </div>
      )}
    </>
  );
}
