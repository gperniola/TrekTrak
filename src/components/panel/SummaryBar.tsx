'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { calculateDifficulty } from '@/lib/calculations';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function SummaryBar() {
  const legs = useItineraryStore((s) => s.legs);

  const totalDistance = legs.reduce((sum, l) => sum + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((sum, l) => sum + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((sum, l) => sum + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((sum, l) => sum + (l.estimatedTime ?? 0), 0);
  const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));
  const difficulty = calculateDifficulty(maxSlope);

  return (
    <div className="border-t border-gray-700 p-3 bg-gray-900">
      <div className="flex justify-between text-xs mb-1">
        <span>{totalDistance.toFixed(1)} km</span>
        <span className="text-red-400">+{totalGain}m</span>
        <span className="text-blue-400">-{totalLoss}m</span>
        <span>{formatTime(totalTime)}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Difficolta: {difficulty}</span>
      </div>
    </div>
  );
}
