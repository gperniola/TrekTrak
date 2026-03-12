'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import type { AppMode } from '@/lib/types';

export function ModeSwitch() {
  const appMode = useItineraryStore((s) => s.appMode);
  const setAppMode = useItineraryStore((s) => s.setAppMode);

  const isTrack = appMode === 'track';

  const handleToggle = (mode: AppMode) => {
    if (mode !== appMode) setAppMode(mode);
  };

  return (
    <div className="flex items-center px-3 py-2 border-b border-gray-700" role="tablist">
      <button
        role="tab"
        aria-selected={!isTrack}
        onClick={() => handleToggle('learn')}
        className={`flex-1 py-1.5 rounded-l text-xs font-bold transition-colors ${
          !isTrack
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:text-gray-300'
        }`}
      >
        Learn
      </button>
      <button
        role="tab"
        aria-selected={isTrack}
        onClick={() => handleToggle('track')}
        className={`flex-1 py-1.5 rounded-r text-xs font-bold transition-colors ${
          isTrack
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:text-gray-300'
        }`}
      >
        Track
      </button>
    </div>
  );
}
