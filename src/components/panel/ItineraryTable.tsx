'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal } from '@/lib/calculations';
import { numero, percento, durataMin } from '@/lib/formato';

export function ItineraryTable() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (legs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        Aggiungi almeno 2 waypoint per vedere la tabella
      </div>
    );
  }

  // Somma solo i valori noti; `null` se nessuno c'è (in «Impara» prima di compilare, un
  // totale che non si conosce non è 0 — la classe «non lo so ≠ zero»).
  const somma = (vals: Array<number | null | undefined>): number | null => {
    const noti = vals.filter((v): v is number => v != null && Number.isFinite(v));
    return noti.length === 0 ? null : noti.reduce((a, b) => a + b, 0);
  };
  const totalDist = somma(legs.map((l) => l.distance));
  const totalGain = somma(legs.map((l) => l.elevationGain));
  const totalLoss = somma(legs.map((l) => l.elevationLoss));
  const totalTime = somma(legs.map((l) => l.estimatedTime));

  return (
    <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-gray-400 uppercase bg-gray-900">
          <tr>
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Da</th>
            <th className="px-2 py-1">A</th>
            <th className="px-2 py-1">Dist</th>
            <th className="px-2 py-1">Az</th>
            <th className="px-2 py-1">D+</th>
            <th className="px-2 py-1">D-</th>
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
                <td className="px-2 py-1">{from?.name || `Waypoint ${(from?.order ?? i) + 1}`}</td>
                <td className="px-2 py-1">{to?.name || `Waypoint ${(to?.order ?? i + 1) + 1}`}</td>
                <td className="px-2 py-1">{leg.distance != null ? numero(leg.distance, 1) : '-'}</td>
                <td className="px-2 py-1">{leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-'}</td>
                <td className="px-2 py-1 text-red-400">{leg.elevationGain ?? '-'}</td>
                <td className="px-2 py-1 text-blue-400">{leg.elevationLoss ?? '-'}</td>
                <td className="px-2 py-1">{leg.estimatedTime != null ? durataMin(leg.estimatedTime) : '-'}</td>
                <td className="px-2 py-1">{leg.slope != null ? percento(leg.slope) : '-'}</td>
              </tr>
            );
          })}
          <tr className="font-bold bg-gray-900">
            <td className="px-2 py-1" colSpan={3}>Totale</td>
            <td className="px-2 py-1">{totalDist == null ? '-' : numero(totalDist, 1)}</td>
            <td className="px-2 py-1">-</td>
            <td className="px-2 py-1 text-red-400">{totalGain == null ? '-' : numero(totalGain)}</td>
            <td className="px-2 py-1 text-blue-400">{totalLoss == null ? '-' : numero(totalLoss)}</td>
            <td className="px-2 py-1">{totalTime == null ? '-' : durataMin(totalTime)}</td>
            <td className="px-2 py-1">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
