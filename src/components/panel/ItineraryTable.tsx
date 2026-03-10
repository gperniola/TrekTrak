'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal } from '@/lib/calculations';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function ItineraryTable() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (legs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Aggiungi almeno 2 waypoint per vedere la tabella
      </div>
    );
  }

  const totalDist = legs.reduce((s, l) => s + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((s, l) => s + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((s, l) => s + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((s, l) => s + (l.estimatedTime ?? 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-gray-400 uppercase bg-gray-900">
          <tr>
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Da</th>
            <th className="px-2 py-1">A</th>
            <th className="px-2 py-1">Dist</th>
            <th className="px-2 py-1">D+</th>
            <th className="px-2 py-1">D-</th>
            <th className="px-2 py-1">Az</th>
            <th className="px-2 py-1">Tempo</th>
            <th className="px-2 py-1">Pend</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            const from = waypoints.find((w) => w.id === leg.fromWaypointId);
            const to = waypoints.find((w) => w.id === leg.toWaypointId);
            return (
              <tr key={leg.id} className="border-b border-gray-800">
                <td className="px-2 py-1">{i + 1}</td>
                <td className="px-2 py-1">{from?.name || `WP${i + 1}`}</td>
                <td className="px-2 py-1">{to?.name || `WP${i + 2}`}</td>
                <td className="px-2 py-1">{leg.distance?.toFixed(1) ?? '-'}</td>
                <td className="px-2 py-1 text-red-400">{leg.elevationGain ?? '-'}</td>
                <td className="px-2 py-1 text-blue-400">{leg.elevationLoss ?? '-'}</td>
                <td className="px-2 py-1">{leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-'}</td>
                <td className="px-2 py-1">{leg.estimatedTime != null ? formatTime(leg.estimatedTime) : '-'}</td>
                <td className="px-2 py-1">{leg.slope != null ? `${leg.slope.toFixed(1)}%` : '-'}</td>
              </tr>
            );
          })}
          <tr className="font-bold bg-gray-900">
            <td className="px-2 py-1" colSpan={3}>Totale</td>
            <td className="px-2 py-1">{totalDist.toFixed(1)}</td>
            <td className="px-2 py-1 text-red-400">{totalGain}</td>
            <td className="px-2 py-1 text-blue-400">{totalLoss}</td>
            <td className="px-2 py-1">-</td>
            <td className="px-2 py-1">{formatTime(totalTime)}</td>
            <td className="px-2 py-1">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
