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
  const pts = route.waypoints
    .filter((w) => w.lat != null && w.lon != null)
    .map((w) => [w.lat as number, w.lon as number] as [number, number]);

  useEffect(() => {
    if (pts.length === 0) return;
    if (pts.length === 1) { map.setView(pts[0], 14); return; }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  if (pts.length === 0) return null;

  return (
    <>
      {pts.length >= 2 && <Polyline positions={pts} pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.85 }} />}
      {pts.map((p, i) => <Marker key={i} position={p} icon={numberedIcon(i + 1)} interactive={false} />)}
    </>
  );
}
