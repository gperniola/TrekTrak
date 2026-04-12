'use client';

import { useState, useRef, useEffect } from 'react';
import type { Leg } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadPDF } from '@/lib/export-pdf';
import { downloadGPX } from '@/lib/export-gpx';
import { calculateDifficulty, haversineDistance, forwardAzimuth, interpolatePoints, cumulativeElevation, sampleInterval } from '@/lib/calculations';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { validateValue, validateAzimuth, percentageTolerance } from '@/lib/validation';
import { fetchTrailRoute } from '@/lib/routing-api';
import { buildMeteoUrl } from '@/lib/meteo';
import { encodeItinerary } from '@/lib/share-url';
import { saveValidationSession } from '@/lib/storage';
import type { ValidationSessionResult } from '@/lib/types';


export function ActionBar({ onOpenProgress }: { onOpenProgress?: () => void }) {
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const updateLeg = useItineraryStore((s) => s.updateLeg);
  const appMode = useItineraryStore((s) => s.appMode);
  const [verifying, setVerifying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);
  const verifyGenerationRef = useRef(0);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; verifyGenerationRef.current++; if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); }; }, []);
  const [verifyBanner, setVerifyBanner] = useState<{ valid: number; warning: number; error: number } | null>(null);
  const [bannerFading, setBannerFading] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalDistance = legs.reduce((sum, l) => sum + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((sum, l) => sum + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((sum, l) => sum + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((sum, l) => sum + (l.estimatedTime ?? 0), 0);
  const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));

  const handlePDF = (format: 'summary' | 'roadbook') => {
    if (waypoints.length < 2) {
      alert('Aggiungi almeno 2 waypoint');
      return;
    }
    // PDF is useful even without coordinates, so only check waypoint count
    downloadPDF({
      name: itineraryName,
      waypoints,
      legs,
      totalDistance,
      totalElevGain: totalGain,
      totalElevLoss: totalLoss,
      totalTime,
      difficulty: calculateDifficulty(maxSlope),
    }, format);
  };

  const handleGPX = () => {
    const validCoordWps = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
    if (validCoordWps.length < 2) {
      alert('Servono almeno 2 waypoint con coordinate valide per il GPX');
      return;
    }
    downloadGPX(itineraryName, waypoints, legs);
  };

  const handleVerify = async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    const generation = ++verifyGenerationRef.current;
    const isStale = () => !mountedRef.current || verifyGenerationRef.current !== generation;
    try {
      let apiAvailable = true;

      // Clear all previous validation state in one batch
      useItineraryStore.getState().clearAllValidation();

      // Read tolerances from fresh store state (not stale closure)
      const tol = useItineraryStore.getState().settings.tolerances;

      // Cache elevation lookups to avoid duplicate API calls
      const elevationCache = new Map<string, number | null>();
      const getCachedElevation = async (lat: number, lon: number): Promise<number | null> => {
        const key = `${lat},${lon}`;
        if (elevationCache.has(key)) return elevationCache.get(key) ?? null;
        const result = await fetchElevation(lat, lon);
        elevationCache.set(key, result);
        return result;
      };

      const currentState = useItineraryStore.getState();
      const currentWaypoints = currentState.waypoints;
      const currentLegs = currentState.legs;
      const useTrailRouting = currentState.settings.mapDisplay.trailRouting;

      // --- Phase 1: Validate legs (distance, azimuth, D+/D-) ---
      for (const leg of currentLegs) {
        if (isStale()) break;
        const from = currentWaypoints.find((w) => w.id === leg.fromWaypointId);
        const to = currentWaypoints.find((w) => w.id === leg.toWaypointId);
        if (from?.lat == null || from?.lon == null || to?.lat == null || to?.lon == null) continue;

        const validationUpdates: Partial<NonNullable<typeof leg.validationState>> = {};
        const fieldUpdates: Partial<Leg> = {};

        // Azimuth (always straight-line, regardless of routing mode)
        const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
        if (leg.azimuth != null) {
          validationUpdates.azimuth = validateAzimuth(leg.azimuth, realAz, {
            strict: tol.azimuth,
            loose: tol.azimuth * 2,
          });
        } else {
          fieldUpdates.azimuth = Math.round(realAz * 10) / 10;
        }

        // Try ORS trail routing if enabled
        const trailRoute = useTrailRouting
          ? await fetchTrailRoute(from.lat, from.lon, to.lat, to.lon)
          : null;
        if (isStale()) break;

        if (trailRoute) {
          // --- Trail routing: use ORS distance, D+/D-, and elevations ---
          const realDist = trailRoute.distanceKm;
          if (leg.distance != null) {
            const distTol = realDist > 0
              ? percentageTolerance(realDist, tol.distance)
              : { strict: tol.distance / 100, loose: (tol.distance / 100) * 2 };
            validationUpdates.distance = validateValue(leg.distance, realDist, distTol);
          } else {
            fieldUpdates.distance = Math.round(realDist * 1000) / 1000;
          }

          const realGain = Math.round(trailRoute.ascent);
          const realLoss = Math.round(trailRoute.descent);
          if (leg.elevationGain != null) {
            const elevGainTol = realGain > 0
              ? percentageTolerance(realGain, tol.elevationDelta)
              : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
            validationUpdates.elevationGain = validateValue(leg.elevationGain, realGain, elevGainTol);
          } else {
            fieldUpdates.elevationGain = realGain;
          }
          if (leg.elevationLoss != null) {
            const elevLossTol = realLoss > 0
              ? percentageTolerance(realLoss, tol.elevationDelta)
              : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
            validationUpdates.elevationLoss = validateValue(leg.elevationLoss, realLoss, elevLossTol);
          } else {
            fieldUpdates.elevationLoss = realLoss;
          }

          // Cache endpoint altitudes from ORS
          if (trailRoute.fromElevation != null) elevationCache.set(`${from.lat},${from.lon}`, trailRoute.fromElevation);
          if (trailRoute.toElevation != null) elevationCache.set(`${to.lat},${to.lon}`, trailRoute.toElevation);
        } else {
          // --- Classic: straight-line distance + DEM elevation sampling ---
          const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
          if (leg.distance != null) {
            const distTol = realDist > 0
              ? percentageTolerance(realDist, tol.distance)
              : { strict: tol.distance / 100, loose: (tol.distance / 100) * 2 };
            validationUpdates.distance = validateValue(leg.distance, realDist, distTol);
          } else {
            fieldUpdates.distance = Math.round(realDist * 1000) / 1000;
          }

          const distM = realDist * 1000;
          const userInterval = useItineraryStore.getState().settings.mapDisplay.sampleInterval;
          const numPoints = Math.max(2, Math.ceil(distM / sampleInterval(distM, userInterval)));
          const profilePoints = interpolatePoints(from.lat, from.lon, to.lat, to.lon, numPoints);
          const profileElevations = await fetchElevationProfile(profilePoints);
          if (isStale()) break;

          const firstAlt = profileElevations[0];
          const lastAlt = profileElevations[profileElevations.length - 1];
          if (firstAlt != null) elevationCache.set(`${from.lat},${from.lon}`, firstAlt);
          if (lastAlt != null) elevationCache.set(`${to.lat},${to.lon}`, lastAlt);

          const { gain: realGain, loss: realLoss } = cumulativeElevation(profileElevations);
          if (realGain == null || realLoss == null) {
            apiAvailable = false;
          } else {
            if (leg.elevationGain != null) {
              const elevGainTol = realGain > 0
                ? percentageTolerance(realGain, tol.elevationDelta)
                : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
              validationUpdates.elevationGain = validateValue(leg.elevationGain, realGain, elevGainTol);
            } else {
              fieldUpdates.elevationGain = realGain;
            }
            if (leg.elevationLoss != null) {
              const elevLossTol = realLoss > 0
                ? percentageTolerance(realLoss, tol.elevationDelta)
                : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
              validationUpdates.elevationLoss = validateValue(leg.elevationLoss, realLoss, elevLossTol);
            } else {
              fieldUpdates.elevationLoss = realLoss;
            }
          }
        }

        const legUpdate: Partial<Leg> = { ...fieldUpdates };
        if (Object.keys(validationUpdates).length > 0) {
          legUpdate.validationState = validationUpdates;
        }
        if (Object.keys(legUpdate).length > 0) {
          updateLeg(leg.id, legUpdate);
        }
      }

      // --- Phase 2: Validate waypoint altitudes ---
      // Most waypoints already have their elevation cached from profile endpoints above.
      // Only orphan waypoints (not connected to any leg) will trigger a new API call.
      for (const wp of currentWaypoints) {
        if (isStale()) break;
        if (wp.lat == null || wp.lon == null) continue;
        const realAlt = await getCachedElevation(wp.lat, wp.lon);
        if (realAlt == null) {
          apiAvailable = false;
          continue;
        }
        if (wp.altitude != null) {
          updateWaypoint(wp.id, {
            validationState: { altitude: validateValue(wp.altitude, realAlt, {
              strict: tol.altitude,
              loose: tol.altitude * 2,
            }) },
          });
        } else {
          updateWaypoint(wp.id, { altitude: Math.round(realAlt) });
        }
      }

      if (!apiAvailable && mountedRef.current) {
        alert('Alcuni dati non sono stati verificati: servizio altimetrico non disponibile. Distanza e azimuth sono stati comunque validati.');
      }

      // --- Collect results and save validation session ---
      if (mountedRef.current && !isStale()) {
        const finalState = useItineraryStore.getState();
        const sessionResults: ValidationSessionResult[] = [];
        let validCount = 0;
        let warningCount = 0;
        let errorCount = 0;

        for (const wp of finalState.waypoints) {
          const altV = wp.validationState?.altitude;
          if (altV && altV.status !== 'unverified') {
            sessionResults.push({
              field: 'altitude',
              status: altV.status,
              delta: altV.delta ?? 0,
              tolerance: altV.tolerance,
            });
            if (altV.status === 'valid') validCount++;
            else if (altV.status === 'warning') warningCount++;
            else errorCount++;
          }
        }
        for (const leg of finalState.legs) {
          const fields = [
            { key: 'distance' as const, v: leg.validationState?.distance },
            { key: 'elevationGain' as const, v: leg.validationState?.elevationGain },
            { key: 'elevationLoss' as const, v: leg.validationState?.elevationLoss },
            { key: 'azimuth' as const, v: leg.validationState?.azimuth },
          ];
          for (const { key, v } of fields) {
            if (v && v.status !== 'unverified') {
              sessionResults.push({
                field: key,
                status: v.status,
                delta: v.delta ?? 0,
                tolerance: v.tolerance,
              });
              if (v.status === 'valid') validCount++;
              else if (v.status === 'warning') warningCount++;
              else errorCount++;
            }
          }
        }

        if (sessionResults.length > 0) {
          saveValidationSession({
            date: new Date().toISOString(),
            itineraryName: finalState.itineraryName,
            results: sessionResults,
          });
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          setBannerFading(false);
          setVerifyBanner({ valid: validCount, warning: warningCount, error: errorCount });
          bannerTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setBannerFading(true);
            bannerTimerRef.current = setTimeout(() => {
              if (mountedRef.current) { setVerifyBanner(null); setBannerFading(false); }
            }, 300);
          }, 3700);
        }
      }
    } finally {
      verifyingRef.current = false;
      if (mountedRef.current) setVerifying(false);
    }
  };

  const handleShareLink = () => {
    const hash = encodeItinerary(itineraryName, waypoints, legs);
    if (!hash) {
      alert('Itinerario troppo grande per la condivisione via link. Usa Export JSON.');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      alert('Impossibile copiare il link. Copia manualmente:\n' + url);
    });
  };

  return (
    <div className="border-t border-gray-700 p-3 space-y-2">
      {verifyBanner && (
        <div
          role="status"
          aria-live="polite"
          onClick={() => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); setVerifyBanner(null); setBannerFading(false); }}
          className={`bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-center cursor-pointer transition-opacity duration-300 ${bannerFading ? 'opacity-0' : 'opacity-100'}`}
        >
          Verifica completata:{' '}
          <span className="text-green-400 font-bold">{verifyBanner.valid} ✓</span>
          {' · '}
          <span className="text-yellow-400 font-bold">{verifyBanner.warning} ~</span>
          {' · '}
          <span className="text-red-400 font-bold">{verifyBanner.error} ✗</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handlePDF('summary')}
          className="flex-1 py-2 bg-green-500 text-black rounded font-bold text-xs hover:bg-green-400"
        >
          PDF Sintetico
        </button>
        <button
          onClick={() => handlePDF('roadbook')}
          className="flex-1 py-2 bg-green-600 text-black rounded font-bold text-xs hover:bg-green-500"
        >
          PDF Roadbook
        </button>
        <button
          onClick={handleGPX}
          className="flex-1 py-2 bg-blue-500 text-black rounded font-bold text-xs hover:bg-blue-400"
        >
          GPX
        </button>
        {(() => {
          const meteoUrl = buildMeteoUrl(waypoints);
          return meteoUrl ? (
            <button
              onClick={() => window.open(meteoUrl, '_blank')}
              className="flex-1 py-2 bg-cyan-600 text-black rounded font-bold text-xs hover:bg-cyan-500"
            >
              Meteo
            </button>
          ) : null;
        })()}
        <button
          onClick={handleShareLink}
          disabled={waypoints.length < 2}
          className="flex-1 py-2 bg-amber-500 text-black rounded font-bold text-xs hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {linkCopied ? 'Copiato!' : 'Copia link'}
        </button>
        {appMode === 'learn' && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex-1 py-2 bg-purple-500 text-black rounded font-bold text-xs hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? 'Verificando...' : 'Verifica'}
          </button>
        )}
        {onOpenProgress && (
          <button
            onClick={onOpenProgress}
            className="flex-1 py-2 bg-indigo-500 text-black rounded font-bold text-xs hover:bg-indigo-400"
          >
            📊 Progresso
          </button>
        )}
      </div>
    </div>
  );
}
