'use client';

import { useState } from 'react';
import type { Waypoint } from '@/lib/types';
import { NumberInput } from '@/components/shared/NumberInput';
import { useItineraryStore } from '@/stores/itineraryStore';

export function WaypointCard({ waypoint, dragHandleProps }: { waypoint: Waypoint; dragHandleProps?: Record<string, unknown> }) {
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const removeWaypoint = useItineraryStore((s) => s.removeWaypoint);
  const isTrack = useItineraryStore((s) => s.appMode) === 'track';
  const [editing, setEditing] = useState(false);

  const displayName = waypoint.name || `Waypoint ${waypoint.order + 1}`;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-green-400 font-bold text-sm truncate">
            {waypoint.order + 1}. {displayName}
          </span>
          <button
            onClick={() => setEditing((p) => !p)}
            className="text-gray-500 hover:text-gray-300 text-sm shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
            aria-label="Modifica nome"
            title="Modifica nome"
          >
            ✎
          </button>
        </div>
        <div className="flex gap-1 items-center shrink-0">
          <span {...dragHandleProps} className="cursor-grab text-gray-600 hover:text-gray-400 text-xs px-1" title="Trascina per riordinare" aria-label="Trascina per riordinare">
            ☰
          </span>
          <button
            onClick={() => {
              if (confirm(`Rimuovere waypoint "${displayName}"?`)) {
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
      {editing && (
        <div className="mb-2">
          <input
            type="text"
            value={waypoint.name}
            onChange={(e) => updateWaypoint(waypoint.id, { name: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
            maxLength={100}
            placeholder="Nome waypoint..."
            aria-label={`Nome waypoint ${waypoint.order + 1}`}
            autoFocus
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none"
          />
        </div>
      )}
      {waypoint.order === 0 && (
        <div className="text-[10px] text-gray-500 mb-1" title="World Geodetic System 1984 — EPSG:4326">
          Coordinate: <span className="text-gray-400 font-medium">WGS84</span> — gradi decimali
        </div>
      )}
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
          info="Latitudine WGS84 in gradi decimali (-90 a 90)"
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
          info="Longitudine WGS84 in gradi decimali (-180 a 180)"
        />
        <NumberInput
          label="Alt"
          unit="m"
          value={waypoint.altitude}
          onChange={(v) => updateWaypoint(waypoint.id, { altitude: v })}
          validation={waypoint.validationState?.altitude}
          validationFieldType="altitude"
          placeholder=""
          info="Altitudine sul livello del mare in metri"
          readOnly={isTrack}
        />
      </div>
    </div>
  );
}
