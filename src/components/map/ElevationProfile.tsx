'use client';

import { useId, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';
import { buildGradientStops } from '@/lib/calculations';
import type { Leg } from '@/lib/types';

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
  const { profileData, waypointDots, realProfileData } = useMemo(() => {
    let data: { distance: number; altitude: number }[] = [];
    let globalDist = 0;

    // TASK-29 / R2 review fix: when overlaying real-vs-estimated in Learn mode,
    // both profiles must share the same X-axis to be didactically meaningful.
    // If trackValues.distance is available per leg, use those for spacing the
    // user's waypoint altitudes; otherwise fall back to the user's own distance.
    const hasRealReference = appMode === 'learn' && legs.some((l) => l.trackValues?.distance != null);
    const spacingFor = (leg: Leg): number | null => {
      if (hasRealReference) {
        const td = leg.trackValues?.distance;
        if (td != null) return td;
      }
      return leg.distance;
    };

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (leg.elevationProfile && leg.elevationProfile.length >= 2) {
        for (let j = 0; j < leg.elevationProfile.length; j++) {
          // Skip first point of subsequent legs (same as last point of previous)
          if (i > 0 && j === 0) continue;
          const p = leg.elevationProfile[j];
          data.push({
            distance: parseFloat((globalDist + p.distance).toFixed(4)),
            altitude: p.altitude,
          });
        }
        // Use the profile's own last distance for continuity (may differ slightly from leg.distance)
        const profileEnd = leg.elevationProfile[leg.elevationProfile.length - 1].distance;
        globalDist += profileEnd;
      } else {
        // Fallback: use waypoint altitudes only, spaced by the chosen distance source
        const spacing = spacingFor(leg);
        if (spacing == null) continue;
        const fromWp = waypoints.find((w) => w.id === leg.fromWaypointId);
        const toWp = waypoints.find((w) => w.id === leg.toWaypointId);
        if (i === 0 && fromWp?.altitude != null) {
          data.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: fromWp.altitude });
        }
        globalDist += spacing;
        if (toWp?.altitude != null) {
          data.push({ distance: parseFloat(globalDist.toFixed(4)), altitude: toWp.altitude });
        }
      }
    }

    // Build waypoint positions with cumulative distance (used for fallback + dots).
    // Use the same spacing source as the profile (real distance when overlaying).
    const dots: { distance: number; altitude: number; name: string }[] = [];
    let wpCumulDist = 0;
    waypoints.forEach((wp, i) => {
      if (i > 0) {
        const prevWp = waypoints[i - 1];
        const leg = legs.find(
          (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
        );
        if (leg) {
          const spacing = spacingFor(leg);
          if (spacing != null) wpCumulDist += spacing;
        }
      }
      if (wp.altitude != null) {
        dots.push({
          distance: parseFloat(wpCumulDist.toFixed(4)),
          altitude: wp.altitude,
          name: wp.name || `WP${i + 1}`,
        });
      }
    });

    // If no legs have profile data, fall back to waypoint-only data
    if (data.length < 2) {
      data = dots.map(({ name, ...rest }) => rest);
    }

    // TASK-29: build the "real" profile from trackValues.elevationProfile when
    // available — used to overlay reality on top of the user's "flat" estimate
    // in Learn mode after a previous Track session.
    let realData: { distance: number; altitude: number }[] = [];
    if (appMode === 'learn') {
      let realCum = 0;
      let anyReal = false;
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const realProfile = leg.trackValues?.elevationProfile;
        if (realProfile && realProfile.length >= 2) {
          anyReal = true;
          for (let j = 0; j < realProfile.length; j++) {
            if (i > 0 && j === 0) continue;
            const p = realProfile[j];
            realData.push({
              distance: parseFloat((realCum + p.distance).toFixed(4)),
              altitude: p.altitude,
            });
          }
          realCum += realProfile[realProfile.length - 1].distance;
        } else if (leg.distance != null) {
          // No real profile for this leg — advance the cumulative anyway so distances stay aligned
          realCum += leg.trackValues?.distance ?? leg.distance;
        }
      }
      if (!anyReal) realData = [];
    }
    return { profileData: data, waypointDots: dots, realProfileData: realData };
  }, [waypoints, legs, appMode]);

  // CRITICAL: all hooks must be called BEFORE any early return (Rules of Hooks).
  // Merge user + real profiles into one dataset so Recharts can render both Areas
  // on the same x-axis. Gaps are OK (Area with `connectNulls`).
  const hasReal = realProfileData.length >= 2;
  const mergedData = useMemo(() => {
    if (!hasReal) return profileData.map((p) => ({ distance: p.distance, altitude: p.altitude, realAltitude: undefined as number | undefined }));
    const byDist = new Map<number, { distance: number; altitude?: number; realAltitude?: number }>();
    for (const p of profileData) {
      byDist.set(p.distance, { distance: p.distance, altitude: p.altitude });
    }
    for (const p of realProfileData) {
      const existing = byDist.get(p.distance);
      if (existing) existing.realAltitude = p.altitude;
      else byDist.set(p.distance, { distance: p.distance, realAltitude: p.altitude });
    }
    return Array.from(byDist.values()).sort((a, b) => a.distance - b.distance);
  }, [profileData, realProfileData, hasReal]);

  // (In vista Libreria il pannello profilo è gestito da page.tsx con
  // PreviewElevationProfile: questo componente è montato solo in vista Editor.)
  if (profileData.length < 2) {
    // Distinguere i due casi: con 3 waypoint senza quota, "aggiungi almeno 2 waypoint"
    // e' una frase che non dice cosa fare — i waypoint ci sono, mancano le quote.
    const conQuota = waypoints.filter((wp) => wp.altitude != null).length;
    const messaggio = waypoints.length < 2
      ? 'Tocca la mappa per aggiungere almeno 2 waypoint: qui comparir\u00e0 il profilo altimetrico'
      : conQuota < 2
        ? 'Inserisci la quota di almeno 2 waypoint nell\u2019Editor: qui comparir\u00e0 il profilo altimetrico'
        : 'Servono almeno 2 waypoint con quota e coordinate per il profilo altimetrico';
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm text-center px-4">
        {messaggio}
      </div>
    );
  }

  const minAlt = profileData.reduce((min, d) => Math.min(min, d.altitude), Infinity);
  const maxAlt = profileData.reduce((max, d) => Math.max(max, d.altitude), -Infinity);
  // Extend Y domain to include real altitudes if present
  const realMin = hasReal ? realProfileData.reduce((min, d) => Math.min(min, d.altitude), Infinity) : Infinity;
  const realMax = hasReal ? realProfileData.reduce((max, d) => Math.max(max, d.altitude), -Infinity) : -Infinity;
  const minAltCombined = Math.min(minAlt, realMin);
  const maxAltCombined = Math.max(maxAlt, realMax);
  // Adaptive padding: keep the curve visually expressive even for small altitude ranges.
  // - Range < 50m → 5m padding (tight)
  // - 50m ≤ range < 200m → linearly interpolate 5m → 10m
  // - Range ≥ 200m → 10% of range
  // Also round to 5m for small ranges (vs 10m) to avoid wasting visual space.
  const range = maxAltCombined - minAltCombined;
  const padding = range < 50 ? 5 : range < 200 ? 5 + (range - 50) / 30 : range * 0.1;
  const roundTo = range < 50 ? 5 : 10;
  const yMin = Math.floor((minAltCombined - padding) / roundTo) * roundTo;
  const yMax = Math.ceil((maxAltCombined + padding) / roundTo) * roundTo;
  const totalDistance = profileData[profileData.length - 1].distance;

  const stops = buildGradientStops(profileData, totalDistance);
  const hasGradient = stops.length > 0;

  return (
    <div className={`h-full p-2 ${isEstimated ? 'bg-amber-950/25' : ''}`}>
      <div className="text-xs mb-1 flex items-center gap-1 flex-wrap">
        <span className="text-gray-400">Profilo altimetrico</span>
        {hasReal && (
          <span className="text-[10px] text-cyan-300 ml-1 flex items-center gap-0.5">
            <span aria-hidden className="inline-block w-3 border-t-2 border-dashed border-cyan-400" />
            reale
          </span>
        )}
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
      <ResponsiveContainer width="100%" height="85%" minWidth={0} minHeight={0}>
        <AreaChart data={mergedData} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave} onClick={handleChartClick}>
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
          {/* Real profile drawn FIRST (behind user profile) when in Learn mode and trackValues are present */}
          {hasReal && (
            <Area
              type="monotone"
              dataKey="realAltitude"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.12}
              strokeWidth={2}
              strokeDasharray="4 3"
              connectNulls
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="altitude"
            stroke={hasGradient ? `url(#${strokeGradientId})` : '#4ade80'}
            fill={`url(#${fillGradientId})`}
            strokeWidth={2}
            connectNulls
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
