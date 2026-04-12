'use client';

import { Polyline } from 'react-leaflet';
import { slopeColor, smoothAltitudes } from '@/lib/calculations';
import type { Leg } from '@/lib/types';

export function ColoredLegSegments({ leg, fromLat, fromLon, toLat, toLon }: {
  leg: Leg;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
}) {
  const profile = leg.elevationProfile;
  const hasRoute = leg.routeGeometry && leg.routeGeometry.length >= 2;

  if (!profile || profile.length < 2) {
    // No profile data — fall back to appropriate non-colored style
    if (hasRoute) {
      return <Polyline positions={leg.routeGeometry!} color="#4ade80" weight={4} />;
    }
    return <Polyline positions={[[fromLat, fromLon], [toLat, toLon]]} color="#9ca3af" weight={2} dashArray="8 4" />;
  }

  const totalDist = profile[profile.length - 1].distance;
  if (totalDist === 0) {
    const pos: [number, number][] = hasRoute ? leg.routeGeometry! : [[fromLat, fromLon], [toLat, toLon]];
    return <Polyline positions={pos} color="#4ade80" weight={3} />;
  }

  // Smooth altitudes to match the elevation chart gradient colors.
  const smoothed = smoothAltitudes(profile);

  type ColorGroup = { color: string; positions: [number, number][] };
  const groups: ColorGroup[] = [];

  // Use route geometry positions if available, otherwise interpolate straight line
  const getPosition = (t: number): [number, number] => {
    if (hasRoute) {
      // Map t (0-1) to the route geometry by index fraction
      const geo = leg.routeGeometry!;
      const idx = t * (geo.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, geo.length - 1);
      const frac = idx - lo;
      return [
        geo[lo][0] + frac * (geo[hi][0] - geo[lo][0]),
        geo[lo][1] + frac * (geo[hi][1] - geo[lo][1]),
      ];
    }
    return [fromLat + t * (toLat - fromLat), fromLon + t * (toLon - fromLon)];
  };

  for (let i = 0; i < profile.length - 1; i++) {
    const t1 = profile[i].distance / totalDist;
    const t2 = profile[i + 1].distance / totalDist;
    const p1 = getPosition(t1);
    const p2 = getPosition(t2);

    const dx = profile[i + 1].distance - profile[i].distance;
    const dy = Math.abs(smoothed[i + 1] - smoothed[i]);
    const slope = dx > 0 ? (dy / (dx * 1000)) * 100 : 0;
    const color = slopeColor(slope);

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.color === color) {
      lastGroup.positions.push(p2);
    } else {
      groups.push({ color, positions: [p1, p2] });
    }
  }

  return (
    <>
      {groups.map((g, i) => (
        <Polyline
          key={`${i}`}
          positions={g.positions}
          color={g.color}
          weight={hasRoute ? 4 : 3}
          dashArray={hasRoute ? undefined : '8 4'}
        />
      ))}
    </>
  );
}
