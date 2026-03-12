'use client';

import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';

export function ElevationProfile() {
  const gradientId = useId();
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  // Build cumulative distance / altitude data, skip waypoints without altitude
  let cumulativeDist = 0;
  const data: { distance: number; altitude: number; name: string }[] = [];
  waypoints.forEach((wp, i) => {
    if (i > 0) {
      const prevWp = waypoints[i - 1];
      const leg = legs.find(
        (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
      );
      if (leg?.distance != null) {
        cumulativeDist += leg.distance;
      }
    }
    if (wp.altitude != null) {
      data.push({
        distance: parseFloat(cumulativeDist.toFixed(2)),
        altitude: wp.altitude,
        name: wp.name || `WP${i + 1}`,
      });
    }
  });

  if (data.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Aggiungi almeno 2 waypoint con quota per il profilo altimetrico
      </div>
    );
  }

  const altitudes = data.map((d) => d.altitude);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const padding = Math.max(10, (maxAlt - minAlt) * 0.1);
  const yMin = Math.floor((minAlt - padding) / 10) * 10;
  const yMax = Math.ceil((maxAlt + padding) / 10) * 10;

  return (
    <div className="h-full p-2">
      <div className="text-xs text-gray-500 mb-1">Profilo altimetrico</div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="distance" tick={{ fontSize: 10, fill: '#999' }} unit=" km" />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="m" domain={[yMin, yMax]} />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }}
            labelStyle={{ color: '#4ade80' }}
          />
          <Area
            type="monotone"
            dataKey="altitude"
            stroke="#4ade80"
            fill={`url(#${gradientId})`}
            strokeWidth={2}
          />
          {data.map((point, i) => (
            <ReferenceDot
              key={`ref-${i}`}
              x={point.distance}
              y={point.altitude}
              r={4}
              fill="#4ade80"
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
