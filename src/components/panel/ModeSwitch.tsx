'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import type { AppMode } from '@/lib/types';

export function ModeSwitch({ compassActive, onCompassToggle }: {
  compassActive?: boolean;
  onCompassToggle?: () => void;
}) {
  const appMode = useItineraryStore((s) => s.appMode);
  const setAppMode = useItineraryStore((s) => s.setAppMode);
  const waypoints = useItineraryStore((s) => s.waypoints);

  const isTrack = appMode === 'track';

  const handleToggle = (mode: AppMode) => {
    // Clicking Learn or Track deactivates compass
    if (compassActive && onCompassToggle) onCompassToggle();
    if (mode === appMode) return;
    if (mode === 'learn' && waypoints.some((wp) => wp.altitude != null || wp.lat != null)) {
      if (!confirm('Passare a Learn cancellerà tutti i dati calcolati (altitudine, distanza, azimuth, D+/D-). Continuare?')) return;
    }
    setAppMode(mode);
  };

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-700 gap-1" role="tablist" aria-label="Modalità app">
      {onCompassToggle && (
        <button
          onClick={onCompassToggle}
          className={`px-2 py-1.5 rounded text-xs font-bold transition-colors ${
            compassActive
              ? 'bg-amber-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:text-gray-300'
          }`}
          aria-label={compassActive ? 'Disattiva bussola' : 'Attiva bussola'}
          aria-pressed={compassActive}
          title="Bussola"
        >
          ◎
        </button>
      )}
      <button
        role="tab"
        aria-selected={!isTrack && !compassActive}
        onClick={() => handleToggle('learn')}
        className={`flex-1 py-1.5 ${onCompassToggle ? 'rounded' : 'rounded-l'} text-xs font-bold transition-colors ${
          !isTrack && !compassActive
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:text-gray-300'
        }`}
      >
        Learn
      </button>
      <button
        role="tab"
        aria-selected={isTrack && !compassActive}
        onClick={() => handleToggle('track')}
        className={`flex-1 py-1.5 ${onCompassToggle ? 'rounded' : 'rounded-r'} text-xs font-bold transition-colors ${
          isTrack && !compassActive
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:text-gray-300'
        }`}
      >
        Track
      </button>
    </div>
  );
}
