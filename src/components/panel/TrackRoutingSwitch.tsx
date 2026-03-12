'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { isRoutingAvailable } from '@/lib/routing-api';
import type { TrackRouting } from '@/lib/types';

export function TrackRoutingSwitch() {
  const appMode = useItineraryStore((s) => s.appMode);
  const trackRouting = useItineraryStore((s) => s.trackRouting);
  const setTrackRouting = useItineraryStore((s) => s.setTrackRouting);

  if (appMode !== 'track') return null;

  const apiAvailable = isRoutingAvailable();
  const isGuided = trackRouting === 'guided';

  const handleToggle = (routing: TrackRouting) => {
    if (routing === 'guided' && !apiAvailable) return;
    if (routing !== trackRouting) setTrackRouting(routing);
  };

  return (
    <div className="flex items-center px-3 py-1.5 border-b border-gray-700">
      <span className="text-xs text-gray-500 mr-2">Routing:</span>
      <div className="flex flex-1" role="tablist">
        <button
          role="tab"
          aria-selected={!isGuided}
          onClick={() => handleToggle('classic')}
          className={`flex-1 py-1 rounded-l text-xs font-bold transition-colors ${
            !isGuided
              ? 'bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
          }`}
        >
          Classica
        </button>
        <button
          role="tab"
          aria-selected={isGuided}
          onClick={() => handleToggle('guided')}
          disabled={!apiAvailable}
          title={!apiAvailable ? 'API key OpenRouteService mancante in .env.local' : undefined}
          className={`flex-1 py-1 rounded-r text-xs font-bold transition-colors ${
            isGuided
              ? 'bg-emerald-600 text-white'
              : apiAvailable
                ? 'bg-gray-800 text-gray-400 hover:text-gray-300'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          Guidata
        </button>
      </div>
    </div>
  );
}
