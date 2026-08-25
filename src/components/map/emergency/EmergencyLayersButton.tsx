'use client';

import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

export function EmergencyLayersButton() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const activeCount = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers.length);

  return (
    <button
      onClick={() => setOpen(!open)}
      aria-label="Layer di emergenza"
      aria-expanded={open}
      title="Layer di emergenza (incendi, allerte)"
      className="absolute bottom-16 right-3 z-[1000] w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg bg-gray-800/90 text-amber-400 hover:bg-gray-700 transition-colors"
    >
      ⚠️
      {activeCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}
