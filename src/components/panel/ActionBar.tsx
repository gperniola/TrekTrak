'use client';

import { useState, useRef, useEffect } from 'react';
import type { Leg } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadPDF } from '@/lib/export-pdf';
import { downloadGPX } from '@/lib/export-gpx';
import { calculateDifficulty, haversineDistance, forwardAzimuth, interpolatePoints, cumulativeElevation, sampleInterval } from '@/lib/calculations';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { validateValue, validateAzimuth, percentageTolerance } from '@/lib/validation';
import { formatTime } from '@/lib/format';

export function ActionBar() {
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const updateLeg = useItineraryStore((s) => s.updateLeg);
  const appMode = useItineraryStore((s) => s.appMode);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);
  const verifyGenerationRef = useRef(0);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; verifyGenerationRef.current++; }; }, []);

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

      // --- Phase 1: Validate legs (distance, azimuth, D+/D-) ---
      // Legs are processed first so that profile endpoint elevations populate the cache,
      // avoiding redundant single-point API calls in the waypoint phase.
      for (const leg of currentLegs) {
        if (isStale()) break;
        const from = currentWaypoints.find((w) => w.id === leg.fromWaypointId);
        const to = currentWaypoints.find((w) => w.id === leg.toWaypointId);
        if (from?.lat == null || from?.lon == null || to?.lat == null || to?.lon == null) continue;

        const validationUpdates: Partial<NonNullable<typeof leg.validationState>> = {};
        const fieldUpdates: Partial<Leg> = {};

        // Distance
        const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
        if (leg.distance != null) {
          const distTol = realDist > 0
            ? percentageTolerance(realDist, tol.distance)
            : { strict: tol.distance / 100, loose: (tol.distance / 100) * 2 };
          validationUpdates.distance = validateValue(leg.distance, realDist, distTol);
        } else {
          fieldUpdates.distance = Math.round(realDist * 1000) / 1000;
        }

        // Azimuth
        const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
        if (leg.azimuth != null) {
          validationUpdates.azimuth = validateAzimuth(leg.azimuth, realAz, {
            strict: tol.azimuth,
            loose: tol.azimuth * 2,
          });
        } else {
          fieldUpdates.azimuth = Math.round(realAz * 10) / 10;
        }

        // Elevation D+/D-: sample profile along the leg (same as Track mode)
        const distM = realDist * 1000;
        const numPoints = Math.min(50, Math.max(2, Math.ceil(distM / sampleInterval(distM))));
        const profilePoints = interpolatePoints(from.lat, from.lon, to.lat, to.lon, numPoints);
        const profileElevations = await fetchElevationProfile(profilePoints);
        if (isStale()) break;

        // Cache endpoint elevations for the waypoint phase
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
    } finally {
      verifyingRef.current = false;
      if (mountedRef.current) setVerifying(false);
    }
  };

  return (
    <div className="border-t border-gray-700 p-3 flex flex-wrap gap-2">
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
      {appMode === 'learn' && (
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex-1 py-2 bg-purple-500 text-black rounded font-bold text-xs hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? 'Verificando...' : 'Verifica'}
        </button>
      )}
    </div>
  );
}
