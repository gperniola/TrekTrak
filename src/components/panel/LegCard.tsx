'use client';

import type { Leg } from '@/lib/types';
import { NumberInput } from '@/components/shared/NumberInput';
import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal } from '@/lib/calculations';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function LegCard({ leg }: { leg: Leg }) {
  const updateLeg = useItineraryStore((s) => s.updateLeg);

  return (
    <div className="bg-gray-900 border-l-2 border-green-400 rounded-r-md p-2 ml-3 text-xs">
      <div className="grid grid-cols-4 gap-2">
        <NumberInput
          label="Dist"
          unit="km"
          value={leg.distance}
          onChange={(v) => updateLeg(leg.id, { distance: v })}
          step={0.1}
          min={0}
          validation={leg.validationState?.distance}
          placeholder="3.2"
        />
        <NumberInput
          label="D+"
          unit="m"
          value={leg.elevationGain}
          onChange={(v) => updateLeg(leg.id, { elevationGain: v })}
          min={0}
          validation={leg.validationState?.elevationGain}
          placeholder="420"
        />
        <NumberInput
          label="D-"
          unit="m"
          value={leg.elevationLoss}
          onChange={(v) => updateLeg(leg.id, { elevationLoss: v })}
          min={0}
          validation={leg.validationState?.elevationLoss}
          placeholder="80"
        />
        <NumberInput
          label="Azimuth"
          unit="°"
          value={leg.azimuth}
          onChange={(v) => updateLeg(leg.id, { azimuth: v })}
          min={0}
          max={360}
          validation={leg.validationState?.azimuth}
          placeholder="245"
        />
      </div>
      {/* Derived data */}
      <div className="flex gap-3 mt-2 text-gray-400">
        {leg.estimatedTime != null && (
          <span>Tempo: {formatTime(leg.estimatedTime)}</span>
        )}
        {leg.slope != null && (
          <span>Pendenza: {leg.slope.toFixed(1)}%</span>
        )}
        {leg.azimuth != null && (
          <span>Dir: {azimuthToCardinal(leg.azimuth)}</span>
        )}
      </div>
    </div>
  );
}
