'use client';

import type { Leg } from '@/lib/types';
import { NumberInput } from '@/components/shared/NumberInput';
import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal } from '@/lib/calculations';
import { formatTime } from '@/lib/format';

export function LegCard({ leg }: { leg: Leg }) {
  const updateLeg = useItineraryStore((s) => s.updateLeg);
  const isTrack = useItineraryStore((s) => s.appMode) === 'track';

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
          validationFieldType="distance"
          placeholder=""
          readOnly={isTrack}
          highlight
          info="Distanza in linea d'aria tra i due waypoint"
        />
        <NumberInput
          label="Azim."
          unit="°"
          value={leg.azimuth}
          onChange={(v) => updateLeg(leg.id, { azimuth: v })}
          min={0}
          max={359.9}
          validation={leg.validationState?.azimuth}
          validationFieldType="azimuth"
          placeholder=""
          readOnly={isTrack}
          highlight
          info="Direzione in gradi rispetto al Nord (0°=N, 90°=E, 180°=S, 270°=W)"
        />
        <NumberInput
          label="D+"
          unit="m"
          value={leg.elevationGain}
          onChange={(v) => updateLeg(leg.id, { elevationGain: v })}
          min={0}
          validation={leg.validationState?.elevationGain}
          validationFieldType="elevation"
          placeholder=""
          readOnly={isTrack}
          highlight
          info="Dislivello positivo cumulativo (metri di salita)"
        />
        <NumberInput
          label="D-"
          unit="m"
          value={leg.elevationLoss}
          onChange={(v) => updateLeg(leg.id, { elevationLoss: v })}
          min={0}
          validation={leg.validationState?.elevationLoss}
          validationFieldType="elevation"
          placeholder=""
          readOnly={isTrack}
          highlight
          info="Dislivello negativo cumulativo (metri di discesa)"
        />
      </div>
      {/* Derived data */}
      <div className="flex flex-wrap gap-3 mt-2 text-gray-400">
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
