'use client';

import { useEffect } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Itinerary } from '@/lib/types';

function numberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#16a34a;color:#000;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #052e16">${n}</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

export function PreviewRouteLayer({ route }: { route: Itinerary }) {
  const map = useMap();
  const wpById = new Map(route.waypoints.map((w) => [w.id, w]));
  const markers = route.waypoints
    .filter((w) => w.lat != null && w.lon != null)
    .map((w) => [w.lat as number, w.lon as number] as [number, number]);

  // Un segmento per leg: routeGeometry se presente (sentiero reale), altrimenti
  // retta tra i due waypoint (percorso tracciato in linea d'aria).
  const segments: [number, number][][] = [];
  for (const leg of route.legs) {
    if (leg.routeGeometry && leg.routeGeometry.length >= 2) {
      segments.push(leg.routeGeometry);
    } else {
      const from = wpById.get(leg.fromWaypointId);
      const to = wpById.get(leg.toWaypointId);
      if (from?.lat != null && from?.lon != null && to?.lat != null && to?.lon != null) {
        segments.push([[from.lat, from.lon], [to.lat, to.lon]]);
      }
    }
  }
  const allPts = segments.flat().concat(markers);

  useEffect(() => {
    if (allPts.length === 0) return;
    if (allPts.length === 1) { map.setView(allPts[0], 14); return; }
    map.fitBounds(L.latLngBounds(allPts), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  if (markers.length === 0 && segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline key={i} positions={seg} pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.85 }} />
      ))}
      {markers.map((p, i) => <Marker key={`m${i}`} position={p} icon={numberedIcon(i + 1)} interactive={false} />)}
    </>
  );
}
