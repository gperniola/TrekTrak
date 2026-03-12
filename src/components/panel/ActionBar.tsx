'use client';

import { useState, useRef, useEffect } from 'react';
import type { Leg } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadPDF } from '@/lib/export-pdf';
import { downloadGPX } from '@/lib/export-gpx';
import { calculateDifficulty } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';
import { validateValue, validateAzimuth, percentageTolerance } from '@/lib/validation';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';
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
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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

      // Read fresh state from store after clearing
      const currentState = useItineraryStore.getState();
      const currentWaypoints = currentState.waypoints;
      const currentLegs = currentState.legs;

      // Validate or auto-fill waypoint altitudes
      for (const wp of currentWaypoints) {
        if (wp.lat == null || wp.lon == null) continue;
        const realAlt = await getCachedElevation(wp.lat, wp.lon);
        if (realAlt == null) {
          apiAvailable = false;
          continue;
        }
        if (wp.altitude != null) {
          const result = validateValue(wp.altitude, realAlt, {
            strict: tol.altitude,
            loose: tol.altitude * 2,
          });
          updateWaypoint(wp.id, {
            validationState: { altitude: result },
          });
        } else {
          updateWaypoint(wp.id, { altitude: Math.round(realAlt) });
        }
      }

      // Validate leg data
      for (const leg of currentLegs) {
        const from = currentWaypoints.find((w) => w.id === leg.fromWaypointId);
        const to = currentWaypoints.find((w) => w.id === leg.toWaypointId);
        if (from?.lat == null || from?.lon == null || to?.lat == null || to?.lon == null) continue;

        const validationUpdates: Partial<NonNullable<typeof leg.validationState>> = {};
        const fieldUpdates: Partial<Leg> = {};

        // Distance: validate if user entered, auto-fill if empty
        const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
        if (leg.distance != null) {
          const distTol = realDist > 0
            ? percentageTolerance(realDist, tol.distance)
            : { strict: tol.distance / 100, loose: (tol.distance / 100) * 2 };
          validationUpdates.distance = validateValue(
            leg.distance,
            realDist,
            distTol
          );
        } else {
          fieldUpdates.distance = Math.round(realDist * 1000) / 1000;
        }

        // Azimuth: validate if user entered, auto-fill if empty
        const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
        if (leg.azimuth != null) {
          validationUpdates.azimuth = validateAzimuth(leg.azimuth, realAz, {
            strict: tol.azimuth,
            loose: tol.azimuth * 2,
          });
        } else {
          fieldUpdates.azimuth = Math.round(realAz * 10) / 10;
        }

        // Elevation gain/loss: validate or auto-fill (uses cached API results)
        const fromAlt = await getCachedElevation(from.lat, from.lon);
        const toAlt = await getCachedElevation(to.lat, to.lon);
        if (fromAlt == null || toAlt == null) {
          if (fromAlt == null && from.lat != null) apiAvailable = false;
          if (toAlt == null && to.lat != null) apiAvailable = false;
        } else {
          const realGain = Math.max(0, toAlt - fromAlt);
          const realLoss = Math.max(0, fromAlt - toAlt);
          if (leg.elevationGain != null) {
            const elevGainTol = realGain > 0
              ? percentageTolerance(realGain, tol.elevationDelta)
              : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
            validationUpdates.elevationGain = validateValue(
              leg.elevationGain,
              realGain,
              elevGainTol
            );
          } else {
            fieldUpdates.elevationGain = Math.round(realGain);
          }
          if (leg.elevationLoss != null) {
            const elevLossTol = realLoss > 0
              ? percentageTolerance(realLoss, tol.elevationDelta)
              : { strict: tol.elevationDelta / 100, loose: (tol.elevationDelta / 100) * 2 };
            validationUpdates.elevationLoss = validateValue(
              leg.elevationLoss,
              realLoss,
              elevLossTol
            );
          } else {
            fieldUpdates.elevationLoss = Math.round(realLoss);
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
