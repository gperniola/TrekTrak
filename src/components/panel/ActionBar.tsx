'use client';

import { useState } from 'react';
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
  const settings = useItineraryStore((s) => s.settings);
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const updateLeg = useItineraryStore((s) => s.updateLeg);
  const [verifying, setVerifying] = useState(false);

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
    if (waypoints.length < 2) {
      alert('Aggiungi almeno 2 waypoint');
      return;
    }
    downloadGPX(itineraryName, waypoints);
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const tol = settings.tolerances;
      let apiAvailable = true;

      // Cache elevation lookups to avoid duplicate API calls
      const elevationCache = new Map<string, number | null>();
      const getCachedElevation = async (lat: number, lon: number): Promise<number | null> => {
        const key = `${lat},${lon}`;
        if (elevationCache.has(key)) return elevationCache.get(key) ?? null;
        const result = await fetchElevation(lat, lon);
        elevationCache.set(key, result);
        return result;
      };

      // Read fresh state from store
      const currentState = useItineraryStore.getState();
      const currentWaypoints = currentState.waypoints;
      const currentLegs = currentState.legs;

      // Validate waypoint altitudes
      for (const wp of currentWaypoints) {
        if (wp.lat == null || wp.lon == null || wp.altitude == null) continue;
        const realAlt = await getCachedElevation(wp.lat, wp.lon);
        if (realAlt == null) {
          apiAvailable = false;
          continue;
        }
        const result = validateValue(wp.altitude, realAlt, {
          strict: tol.altitude,
          loose: tol.altitude * 2,
        });
        updateWaypoint(wp.id, {
          validationState: { altitude: result },
        });
      }

      // Validate leg data
      for (const leg of currentLegs) {
        const from = currentWaypoints.find((w) => w.id === leg.fromWaypointId);
        const to = currentWaypoints.find((w) => w.id === leg.toWaypointId);
        if (from?.lat == null || from?.lon == null || to?.lat == null || to?.lon == null) continue;

        const updates: Partial<NonNullable<typeof leg.validationState>> = {};

        // Distance validation
        if (leg.distance != null) {
          const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
          updates.distance = validateValue(
            leg.distance,
            realDist,
            percentageTolerance(realDist, tol.distance)
          );
        }

        // Azimuth validation (with circular wraparound)
        if (leg.azimuth != null) {
          const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
          updates.azimuth = validateAzimuth(leg.azimuth, realAz, {
            strict: tol.azimuth,
            loose: tol.azimuth * 2,
          });
        }

        // Elevation gain/loss validation (uses cached API results)
        const fromAlt = await getCachedElevation(from.lat, from.lon);
        const toAlt = await getCachedElevation(to.lat, to.lon);
        if (fromAlt == null || toAlt == null) {
          if (fromAlt == null && from.lat != null) apiAvailable = false;
          if (toAlt == null && to.lat != null) apiAvailable = false;
        } else {
          const realGain = Math.max(0, toAlt - fromAlt);
          const realLoss = Math.max(0, fromAlt - toAlt);
          if (leg.elevationGain != null) {
            updates.elevationGain = validateValue(
              leg.elevationGain,
              realGain,
              percentageTolerance(realGain || 1, tol.elevationDelta)
            );
          }
          if (leg.elevationLoss != null) {
            updates.elevationLoss = validateValue(
              leg.elevationLoss,
              realLoss,
              percentageTolerance(realLoss || 1, tol.elevationDelta)
            );
          }
        }

        updateLeg(leg.id, { validationState: { ...leg.validationState, ...updates } });
      }

      if (!apiAvailable) {
        alert('Alcuni dati non sono stati verificati: servizio altimetrico non disponibile. Distanza e azimuth sono stati comunque validati.');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="border-t border-gray-700 p-3 flex gap-2">
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
      <button
        onClick={handleVerify}
        disabled={verifying}
        className="flex-1 py-2 bg-purple-500 text-black rounded font-bold text-xs hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying ? 'Verificando...' : 'Verifica'}
      </button>
    </div>
  );
}
