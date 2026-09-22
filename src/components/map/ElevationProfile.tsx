'use client';

import { useId, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';
import { usePositionStore } from '@/stores/positionStore';
import { buildGradientStops } from '@/lib/calculations';
import { km, metri } from '@/lib/formato';
import {
  costruisciProfilo,
  dominioY,
  messaggioProfiloVuoto,
  quotaA,
  tratteComeNelProfilo,
  uniscoProfili,
} from '@/lib/profilo-altimetrico';
import { posizioneSulProfilo } from '@/lib/posizione-sul-percorso';
import { useChiudiFuori } from '@/lib/useChiudiFuori';

/** Ogni minuto: una posizione invecchia anche se nessuno tocca niente. */
const PASSO_OROLOGIO_MS = 60_000;

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

  /*
    **Dove sono, sul profilo.** Legge la posizione che qualcuno ha gia' ottenuto (avvio,
    tasto, bussola): questo componente non la chiede mai. L'orologio serve perche' il
    punto deve sparire quando la posizione invecchia, anche a schermo fermo — la stessa
    lezione del punto sulla mappa (v0.22.0).
  */
  const posizione = usePositionStore((s) => s.lastKnown);
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    if (posizione == null) return;
    setAdesso(Date.now());
    const t = setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => clearInterval(t);
  }, [posizione]);
  const puntoPosizione = useMemo(() => {
    // Le stesse distanze con cui e' spaziata la curva, non per forza quelle attive.
    const p = posizioneSulProfilo(posizione, waypoints, tratteComeNelProfilo(legs, appMode), adesso);
    if (p == null) return null;
    const quota = quotaA(profileData, p.distanza);
    return quota == null ? null : { distanza: p.distanza, quota };
  }, [posizione, waypoints, legs, appMode, adesso, profileData]);

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
        {puntoPosizione && (
          <span className="text-[10px] text-blue-300 ml-1 flex items-center gap-1">
            <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
            Sei qui: {km(puntoPosizione.distanza, 2)}
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
          {/*
            `domain` esplicito: senza, Recharts usa `[0, 'auto']` e allunga l'asse alla
            tacca «tonda» successiva — un percorso di 10 km stava su un asse da 12, con la
            curva ferma a cinque sesti della larghezza. Con `'dataMax'` gli estremi sono
            fissi e l'ultima tacca e' la lunghezza vera del percorso.
          */}
          <XAxis dataKey="distance" type="number" domain={[0, 'dataMax']} tick={{ fontSize: 10, fill: '#999' }} tickFormatter={(v: number) => km(v, 2)} />
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
          {/*
            Il punto della posizione: stesso blu e stesso anello bianco del punto sulla
            mappa, cosi' l'occhio li legge come la stessa cosa. La riga verticale sotto
            lo rende trovabile anche quando la curva e' piatta e il pallino si confonde
            coi waypoint.
          */}
          {puntoPosizione && (
            <>
              <ReferenceLine x={puntoPosizione.distanza} stroke="#3b82f6" strokeWidth={1} strokeDasharray="2 3" />
              <ReferenceDot
                className="posizione-sul-profilo"
                x={puntoPosizione.distanza}
                y={puntoPosizione.quota}
                r={5}
                fill="#2563eb"
                stroke="#fff"
                strokeWidth={2}
              />
            </>
          )}
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
