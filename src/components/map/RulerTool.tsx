'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapEvents, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { haversineDistance, forwardAzimuth, azimuthToCardinal } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';
import { useMapOverlayGuard } from './useMapOverlayGuard';
import { distanza, gradi } from '@/lib/formato';

interface RulerPoint {
  lat: number;
  lon: number;
  alt: number | null;
}

/**
 * I due capi della misura.
 *
 * Più grandi di prima (18 px contro 14) e con l'ombra: il contorno bianco c'era già ed è
 * la cosa che li rende leggibili su una mappa piena di sentieri colorati, ma a 14 px la
 * lettera dentro era illeggibile e il pallino si confondeva coi simboli dei sentieri.
 * Stessa lingua visiva del mirino della bussola — contorno chiaro, ombra, un simbolo che
 * si vede col dito sopra.
 */
function capoMisura(lettera: 'A' | 'B', colore: string, testo: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;background:${colore};border-radius:50%;`
      + 'border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.55);font-size:10px;'
      + `display:flex;align-items:center;justify-content:center;color:${testo};font-weight:700;`
      + `line-height:1">${lettera}`
      // Il nome accessibile si calcola dal contenuto del marker.
      + '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);'
      + `white-space:nowrap">Punto ${lettera} della misura</span></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const markerA = capoMisura('A', '#16a34a', '#fff');
const markerB = capoMisura('B', '#dc2626', '#fff');

export function RulerTool({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const [pointA, setPointA] = useState<RulerPoint | null>(null);
  const [pointB, setPointB] = useState<RulerPoint | null>(null);
  const clickCountRef = useRef(0);
  const mountedRef = useRef(true);
  // Per-slot generation counters so a stale fetchElevation cannot overwrite
  // a newer click's point (race condition when clicking faster than the API resolves).
  const pointAGenRef = useRef(0);
  const pointBGenRef = useRef(0);
  // Il riquadro delle misure copre una fetta di mappa: senza guardia, toccarlo
  // piazzerebbe un punto del righello dietro di esso. I due riquadri non compaiono
  // mai insieme, quindi una guardia sola basta.
  const guardiaPannello = useMapOverlayGuard<HTMLDivElement>();

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
      pointAGenRef.current++;
      pointBGenRef.current++;
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

    if (count === 0 || count === 2) {
      const gen = ++pointAGenRef.current;
      pointBGenRef.current++; // invalidate any pending B fetch from previous round
      setPointA({ lat, lon: lng, alt: null });
      setPointB(null);
      clickCountRef.current = 1;
      const alt = await fetchElevation(lat, lng);
      if (!mountedRef.current || gen !== pointAGenRef.current) return;
      setPointA((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    } else {
      const gen = ++pointBGenRef.current;
      setPointB({ lat, lon: lng, alt: null });
      clickCountRef.current = 2;
      const alt = await fetchElevation(lat, lng);
      if (!mountedRef.current || gen !== pointBGenRef.current) return;
      setPointB((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
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
    ? distanza(distance, 2)
    : null;

  return (
    <>
      {pointA && (
        <Marker position={[pointA.lat, pointA.lon]} icon={markerA} interactive={false} keyboard={false} />
      )}
      {pointB && (
        <Marker position={[pointB.lat, pointB.lon]} icon={markerB} interactive={false} keyboard={false} />
      )}
      {/*
        La linea, bianca sotto e gialla sopra: la tratteggiata gialla da sola si
        confondeva coi sentieri arancioni della mappa escursionistica.
      */}
      {pointA && pointB && (
        <Polyline
          positions={[[pointA.lat, pointA.lon], [pointB.lat, pointB.lon]]}
          color="#ffffff"
          weight={5}
          opacity={0.8}
          interactive={false}
        />
      )}
      {pointA && pointB && (
        <Polyline
          positions={[[pointA.lat, pointA.lon], [pointB.lat, pointB.lon]]}
          color="#facc15"
          weight={2.5}
          dashArray="6 4"
          interactive={false}
        />
      )}
      {pointA && pointB && (
        <div ref={guardiaPannello} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 flex gap-4 items-center text-sm max-w-[calc(100%-1rem)]">
          <div className="text-center">
            <div className="text-blue-400 font-bold text-base">{distDisplay ?? '--'}</div>
            <div className="text-gray-400 text-[10px]">Distanza</div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <div className="text-blue-400 font-bold text-base">
              {azimuth != null ? `${gradi(azimuth)} ${azimuthToCardinal(azimuth)}` : '--'}
            </div>
            <div className="text-gray-400 text-[10px]">Azimuth</div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <div className={`font-bold text-base ${altDiff != null ? (altDiff >= 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-400'}`}>
              {altDiff != null ? `${altDiff >= 0 ? '+' : ''}${altDiff} m` : '...'}
            </div>
            <div className="text-gray-400 text-[10px]">Δ Quota</div>
          </div>
        </div>
      )}
      {pointA && !pointB && (
        <div ref={guardiaPannello} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 text-sm text-gray-300">
          Clicca il secondo punto
        </div>
      )}
    </>
  );
}
