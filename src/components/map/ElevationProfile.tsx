'use client';

import { useId, useState, useRef, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';
import { buildGradientStops } from '@/lib/calculations';

const ESTIMATED_TOOLTIP = 'Profilo basato solo sulle quote ai waypoint: non riflette salite e discese intermedie.';

export function ElevationProfile() {
  const strokeGradientId = useId();
  const fillGradientId = useId();
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const appMode = useItineraryStore((s) => s.appMode);
  const profileHover = useItineraryStore((s) => s.profileHover);
  const setProfileHover = useItineraryStore((s) => s.setProfileHover);
  const clearProfileHover = useItineraryStore((s) => s.clearProfileHover);
  const setProfileFlyTo = useItineraryStore((s) => s.setProfileFlyTo);

  const isEstimated = appMode === 'learn';

  // Tooltip state for "stimato" label
  const [tipOpen, setTipOpen] = useState(false);
  const tipRef = useRef<HTMLSpanElement>(null);
  const lastHoverTime = useRef(0);

  useEffect(() => {
    if (!tipOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) setTipOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTipOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [tipOpen]);

  const handleChartMouseMove = useCallback((state: { activeLabel?: string | number }) => {
    const now = Date.now();
    if (now - lastHoverTime.current < 60) return;
    lastHoverTime.current = now;
    const dist = state?.activeLabel;
    if (dist != null && typeof dist === 'number') setProfileHover(dist, 'chart');
  }, [setProfileHover]);

  const handleChartMouseLeave = useCallback(() => {
    clearProfileHover();
  }, [clearProfileHover]);

  const handleChartClick = useCallback((state: { activeLabel?: string | number }) => {
    const dist = state?.activeLabel;
    if (dist != null && typeof dist === 'number') setProfileFlyTo(dist);
  }, [setProfileFlyTo]);

  // Try to build detailed profile from leg elevation data
  let profileData: { distance: number; altitude: number }[] = [];
  let globalDist = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.elevationProfile && leg.elevationProfile.length >= 2) {
      for (let j = 0; j < leg.elevationProfile.length; j++) {
        // Skip first point of subsequent legs (same as last point of previous)
        if (i > 0 && j === 0) continue;
        const p = leg.elevationProfile[j];
        profileData.push({
          distance: parseFloat((globalDist + p.distance).toFixed(4)),
          altitude: p.altitude,
        });
      }
      // Use the profile's own last distance for continuity (may differ slightly from leg.distance)
      const profileEnd = leg.elevationProfile[leg.elevationProfile.length - 1].distance;
      globalDist += profileEnd;
    } else if (leg.distance != null) {
      // Fallback: use waypoint altitudes only
      const fromWp = waypoints.find((w) => w.id === leg.fromWaypointId);
      const toWp = waypoints.find((w) => w.id === leg.toWaypointId);
      if (i === 0 && fromWp?.altitude != null) {
        profileData.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: fromWp.altitude });
      }
      globalDist += leg.distance;
      if (toWp?.altitude != null) {
        profileData.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: toWp.altitude });
      }
    }
  }

  // Build waypoint positions with cumulative distance (used for fallback + dots)
  const waypointDots: { distance: number; altitude: number; name: string }[] = [];
  let wpCumulDist = 0;
  waypoints.forEach((wp, i) => {
    if (i > 0) {
      const prevWp = waypoints[i - 1];
      const leg = legs.find(
        (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
      );
      if (leg?.distance != null) wpCumulDist += leg.distance;
    }
    if (wp.altitude != null) {
      waypointDots.push({
        distance: parseFloat(wpCumulDist.toFixed(4)),
        altitude: wp.altitude,
        name: wp.name || `WP${i + 1}`,
      });
    }
  });

  // If no legs have profile data, fall back to waypoint-only data
  if (profileData.length < 2) {
    profileData = waypointDots.map(({ name, ...rest }) => rest);
  }

  if (profileData.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Aggiungi almeno 2 waypoint con quota per il profilo altimetrico
      </div>
    );
  }

  const minAlt = profileData.reduce((min, d) => Math.min(min, d.altitude), Infinity);
  const maxAlt = profileData.reduce((max, d) => Math.max(max, d.altitude), -Infinity);
  const padding = Math.max(10, (maxAlt - minAlt) * 0.1);
  const yMin = Math.floor((minAlt - padding) / 10) * 10;
  const yMax = Math.ceil((maxAlt + padding) / 10) * 10;
  const totalDistance = profileData[profileData.length - 1].distance;

  const stops = buildGradientStops(profileData, totalDistance);
  const hasGradient = stops.length > 0;

  return (
    <div className={`h-full p-2 ${isEstimated ? 'bg-amber-950/25' : ''}`}>
      <div className="text-xs mb-1 flex items-center gap-1">
        <span className="text-gray-400">Profilo altimetrico</span>
        {isEstimated && (
          <span ref={tipRef} className="relative inline-flex">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTipOpen((p) => !p); }}
              className="text-amber-400 font-bold cursor-pointer underline decoration-dotted underline-offset-2 px-1 py-0.5 -mx-1 -my-0.5"
              aria-label="Info profilo stimato"
              aria-expanded={tipOpen}
            >
              stimato ⓘ
            </button>
            {tipOpen && (
              <div role="status" aria-live="polite" className="absolute left-0 top-6 z-[1300] bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-[10px] text-gray-300 shadow-lg max-w-[220px] leading-tight">
                {ESTIMATED_TOOLTIP}
              </div>
            )}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={profileData} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave} onClick={handleChartClick}>
          <defs>
            {hasGradient ? (
              <>
                <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((s, i) => (
                    <stop key={`s-${i}`} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                <linearGradient id={fillGradientId} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((s, i) => (
                    <stop key={`f-${i}`} offset={s.offset} stopColor={s.color} stopOpacity={0.25} />
                  ))}
                </linearGradient>
              </>
            ) : (
              <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
              </linearGradient>
            )}
          </defs>
          <XAxis dataKey="distance" type="number" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={(v: number) => `${v.toFixed(2)} km`} />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="m" domain={[yMin, yMax]} />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }}
            labelStyle={{ color: '#4ade80' }}
            labelFormatter={(v) => `${Number(v).toFixed(2)} km`}
          />
          <Area
            type="monotone"
            dataKey="altitude"
            stroke={hasGradient ? `url(#${strokeGradientId})` : '#4ade80'}
            fill={`url(#${fillGradientId})`}
            strokeWidth={2}
          />
          {waypointDots.map((point, i) => (
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
          {profileHover && profileHover.source === 'map' && (
            <ReferenceLine
              x={profileHover.distance}
              stroke="#facc15"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
