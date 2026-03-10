'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';

export function ElevationProfile() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (waypoints.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Aggiungi almeno 2 waypoint per il profilo altimetrico
      </div>
    );
  }

  // Build cumulative distance / altitude data
  let cumulativeDist = 0;
  const data = waypoints.map((wp, i) => {
    if (i > 0 && legs[i - 1]?.distance != null) {
      cumulativeDist += legs[i - 1].distance!;
    }
    return {
      distance: parseFloat(cumulativeDist.toFixed(2)),
      altitude: wp.altitude ?? 0,
      name: wp.name || `WP${i + 1}`,
    };
  });

  return (
    <div className="h-full p-2">
      <div className="text-xs text-gray-500 mb-1">Profilo altimetrico</div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="altGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="distance" tick={{ fontSize: 10, fill: '#999' }} unit=" km" />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="m" />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }}
            labelStyle={{ color: '#4ade80' }}
          />
          <Area
            type="monotone"
            dataKey="altitude"
            stroke="#4ade80"
            fill="url(#altGradient)"
            strokeWidth={2}
          />
          {data.map((point, i) => (
            <ReferenceDot
              key={i}
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
