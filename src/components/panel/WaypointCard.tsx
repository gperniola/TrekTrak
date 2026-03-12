'use client';

import type { Waypoint } from '@/lib/types';
import { NumberInput } from '@/components/shared/NumberInput';
import { useItineraryStore } from '@/stores/itineraryStore';

export function WaypointCard({ waypoint, dragHandleProps }: { waypoint: Waypoint; dragHandleProps?: Record<string, unknown> }) {
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const removeWaypoint = useItineraryStore((s) => s.removeWaypoint);
  const isTrack = useItineraryStore((s) => s.appMode) === 'track';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-green-400 font-bold text-sm truncate">
          {waypoint.order + 1}. {waypoint.name || 'Senza nome'}
        </span>
        <div className="flex gap-1 items-center">
          <span {...dragHandleProps} className="cursor-grab text-gray-600 hover:text-gray-400 text-xs px-1" title="Trascina per riordinare" aria-label="Trascina per riordinare">
            ☰
          </span>
          <button
            onClick={() => {
              if (confirm(`Rimuovere waypoint "${waypoint.name || 'Senza nome'}"?`)) {
                removeWaypoint(waypoint.id);
              }
            }}
            className="text-gray-500 hover:text-red-400 text-xs px-1"
            title="Rimuovi"
            aria-label="Rimuovi waypoint"
          >
            ✗
          </button>
        </div>
      </div>
      <div className="mb-2">
        <input
          type="text"
          value={waypoint.name}
          onChange={(e) => updateWaypoint(waypoint.id, { name: e.target.value })}
          maxLength={100}
          placeholder="Nome waypoint..."
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput
          label="Lat"
          value={waypoint.lat}
          onChange={(v) => updateWaypoint(waypoint.id, { lat: v })}
          step={0.001}
          min={-90}
          max={90}
          placeholder="46.123"
          readOnly={isTrack}
        />
        <NumberInput
          label="Lon"
          value={waypoint.lon}
          onChange={(v) => updateWaypoint(waypoint.id, { lon: v })}
          step={0.001}
          min={-180}
          max={180}
          placeholder="11.456"
          readOnly={isTrack}
        />
        <NumberInput
          label="Alt"
          unit="m"
          value={waypoint.altitude}
          onChange={(v) => updateWaypoint(waypoint.id, { altitude: v })}
          validation={waypoint.validationState?.altitude}
          placeholder=""
          readOnly={isTrack}
        />
      </div>
    </div>
  );
}
