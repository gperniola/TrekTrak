'use client';

import { useId, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';
import { buildGradientStops } from '@/lib/calculations';
import { km, metri } from '@/lib/formato';
import {
  costruisciProfilo,
  dominioY,
  messaggioProfiloVuoto,
  uniscoProfili,
} from '@/lib/profilo-altimetrico';
import { useChiudiFuori } from '@/lib/useChiudiFuori';

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
  const tipRef = useChiudiFuori<HTMLSpanElement>(tipOpen, () => setTipOpen(false));
  const lastHoverTime = useRef(0);

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
  const { profileData, waypointDots, realProfileData } = useMemo(
    () => costruisciProfilo(waypoints, legs, appMode),
    [waypoints, legs, appMode],
  );

  // CRITICO: tutti gli hook vanno chiamati PRIMA di ogni ritorno anticipato
  // (regole degli hook), quindi il merge sta qui e non dopo il caso vuoto.
  const hasReal = realProfileData.length >= 2;
  const mergedData = useMemo(
    () => uniscoProfili(profileData, realProfileData),
    [profileData, realProfileData],
  );

  // (In vista Libreria il pannello profilo è gestito da page.tsx con
  // PreviewElevationProfile: questo componente è montato solo in vista Editor.)
  if (profileData.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm text-center px-4">
        {messaggioProfiloVuoto(waypoints, legs)}
      </div>
    );
  }

  const { yMin, yMax } = dominioY(profileData, realProfileData);
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
              className="text-amber-400 font-bold cursor-pointer underline decoration-dotted underline-offset-2 px-1 py-0.5 -mx-1 -my-0.5 relative after:absolute after:-inset-3 after:content-['']"
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
          <XAxis dataKey="distance" type="number" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={(v: number) => km(v, 2)} />
          <YAxis
            tick={{ fontSize: 10, fill: '#999' }}
            domain={[yMin, yMax]}
            // Le quote in montagna passano il migliaio: "1.920 m", non "1920m".
            tickFormatter={(v: number) => metri(v)}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }}
            labelStyle={{ color: '#4ade80' }}
            labelFormatter={(v) => km(Number(v), 2)}
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
