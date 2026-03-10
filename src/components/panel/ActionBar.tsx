'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadPDF } from '@/lib/export-pdf';
import { downloadGPX } from '@/lib/export-gpx';
import { calculateDifficulty } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';
import { validateValue, percentageTolerance } from '@/lib/validation';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';

export function ActionBar() {
  const store = useItineraryStore();
  const { itineraryName, waypoints, legs, settings } = store;

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
    const tol = settings.tolerances;
    let apiAvailable = true;

    // Validate waypoint altitudes
    for (const wp of waypoints) {
      if (wp.lat == null || wp.lon == null || wp.altitude == null) continue;
      const realAlt = await fetchElevation(wp.lat, wp.lon);
      if (realAlt == null) {
        apiAvailable = false;
        continue;
      }
      const result = validateValue(wp.altitude, realAlt, {
        strict: tol.altitude,
        loose: tol.altitude * 2,
      });
      store.updateWaypoint(wp.id, {
        validationState: { altitude: result },
      });
    }

    // Validate leg data
    for (const leg of legs) {
      const from = waypoints.find((w) => w.id === leg.fromWaypointId);
      const to = waypoints.find((w) => w.id === leg.toWaypointId);
      if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) continue;

      const updates: Record<string, unknown> = {};

      // Distance validation
      if (leg.distance != null) {
        const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
        updates.distance = validateValue(
          leg.distance,
          realDist,
          percentageTolerance(realDist, tol.distance)
        );
      }

      // Azimuth validation
      if (leg.azimuth != null) {
        const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
        updates.azimuth = validateValue(leg.azimuth, realAz, {
          strict: tol.azimuth,
          loose: tol.azimuth * 2,
        });
      }

      // Elevation gain/loss validation (requires API altitudes)
      const fromAlt = await fetchElevation(from.lat, from.lon);
      const toAlt = await fetchElevation(to.lat, to.lon);
      if (fromAlt != null && toAlt != null) {
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

      store.updateLeg(leg.id, { validationState: { ...leg.validationState, ...updates } });
    }

    if (!apiAvailable) {
      alert('Alcuni dati non sono stati verificati: servizio altimetrico non disponibile. Distanza e azimuth sono stati comunque validati.');
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
        className="flex-1 py-2 bg-purple-500 text-black rounded font-bold text-xs hover:bg-purple-400"
      >
        Verifica
      </button>
    </div>
  );
}
