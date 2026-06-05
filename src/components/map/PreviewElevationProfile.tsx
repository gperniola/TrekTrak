'use client';

import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { buildGradientStops } from '@/lib/calculations';
import type { Itinerary, Leg, Waypoint } from '@/lib/types';

/** Concatena i profili altimetrici dei leg in un'unica serie distanza→quota. */
function buildProfile(waypoints: Waypoint[], legs: Leg[]): { distance: number; altitude: number }[] {
  const data: { distance: number; altitude: number }[] = [];
  let globalDist = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.elevationProfile && leg.elevationProfile.length >= 2) {
      for (let j = 0; j < leg.elevationProfile.length; j++) {
        if (i > 0 && j === 0) continue; // primo punto = ultimo del leg precedente
        const p = leg.elevationProfile[j];
        data.push({ distance: parseFloat((globalDist + p.distance).toFixed(4)), altitude: p.altitude });
      }
      globalDist += leg.elevationProfile[leg.elevationProfile.length - 1].distance;
    } else if (leg.distance != null) {
      const fromWp = waypoints.find((w) => w.id === leg.fromWaypointId);
      const toWp = waypoints.find((w) => w.id === leg.toWaypointId);
      if (i === 0 && fromWp?.altitude != null) data.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: fromWp.altitude });
      globalDist += leg.distance;
      if (toWp?.altitude != null) data.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: toWp.altitude });
    }
  }
  return data;
}

/** Profilo altimetrico read-only del percorso in anteprima (libreria), colorato per pendenza. */
export function PreviewElevationProfile({ route }: { route: Itinerary }) {
  const fillId = useId();
  const strokeId = useId();
  const data = buildProfile(route.waypoints, route.legs);

  if (data.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500 px-3 text-center">
        Profilo altimetrico non disponibile per questo percorso.
      </div>
    );
  }

  const minAlt = data.reduce((m, d) => Math.min(m, d.altitude), Infinity);
  const maxAlt = data.reduce((m, d) => Math.max(m, d.altitude), -Infinity);
  const range = maxAlt - minAlt;
  const padding = range < 50 ? 5 : range < 200 ? 5 + (range - 50) / 30 : range * 0.1;
  const roundTo = range < 50 ? 5 : 10;
  const yMin = Math.floor((minAlt - padding) / roundTo) * roundTo;
  const yMax = Math.ceil((maxAlt + padding) / roundTo) * roundTo;
  const total = data[data.length - 1].distance;
  const stops = buildGradientStops(data, total);
  const hasGradient = stops.length > 0;

  return (
    <div className="h-full p-2">
      <div className="text-xs mb-1 text-gray-400">Profilo altimetrico</div>
      <ResponsiveContainer width="100%" height="85%" minWidth={0} minHeight={0}>
        <AreaChart data={data}>
          <defs>
            {hasGradient ? (
              <>
                <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((s, i) => <stop key={`s-${i}`} offset={s.offset} stopColor={s.color} />)}
                </linearGradient>
                <linearGradient id={fillId} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((s, i) => <stop key={`f-${i}`} offset={s.offset} stopColor={s.color} stopOpacity={0.25} />)}
                </linearGradient>
              </>
            ) : (
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
              </linearGradient>
            )}
          </defs>
          <XAxis dataKey="distance" type="number" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={(v: number) => `${v.toFixed(1)} km`} />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="m" domain={[yMin, yMax]} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }} labelStyle={{ color: '#4ade80' }} labelFormatter={(v) => `${Number(v).toFixed(2)} km`} />
          <Area type="monotone" dataKey="altitude" stroke={hasGradient ? `url(#${strokeId})` : '#4ade80'} fill={`url(#${fillId})`} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
