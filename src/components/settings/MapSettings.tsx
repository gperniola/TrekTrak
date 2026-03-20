'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { saveSettings } from '@/lib/storage';
import { isRoutingAvailable } from '@/lib/routing-api';
import { useEffect } from 'react';

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
        checked ? 'bg-green-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

export function MapSettings({ onClose }: { onClose: () => void }) {
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const appMode = useItineraryStore((s) => s.appMode);
  const { coloredPath, trailRouting } = settings.mapDisplay;
  const orsAvailable = isRoutingAvailable();

  const toggleSetting = (key: 'coloredPath' | 'trailRouting') => {
    const newSettings = {
      ...settings,
      mapDisplay: { ...settings.mapDisplay, [key]: !settings.mapDisplay[key] },
    };
    updateSettings(newSettings);
    saveSettings(newSettings);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Impostazioni mappa"
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-xs w-full p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-200">Impostazioni mappa</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Trail routing toggle */}
        <div className="flex items-center justify-between py-3 border-t border-gray-700">
          <div>
            <div className="text-sm text-gray-300">Percorso su sentiero</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Calcola distanza e tracciato lungo i sentieri (OpenRouteService)
            </div>
            {!orsAvailable && (
              <div className="text-[10px] text-red-400 mt-1">
                API key ORS non configurata
              </div>
            )}
            {orsAvailable && trailRouting && (
              <div className="text-[10px] text-green-400 mt-1">
                Distanza, D+/D- e tracciato calcolati lungo il sentiero
              </div>
            )}
          </div>
          <ToggleSwitch
            checked={trailRouting}
            onChange={() => toggleSetting('trailRouting')}
            label="Percorso su sentiero"
          />
        </div>

        {/* Colored path toggle */}
        <div className="flex items-center justify-between py-3 border-t border-gray-700">
          <div>
            <div className="text-sm text-gray-300">Percorso colorato</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Colora la linea del percorso in base alla pendenza
            </div>
            {appMode === 'learn' && coloredPath && (
              <div className="text-[10px] text-amber-400 mt-1">
                Disponibile in modalità Track con profilo calcolato
              </div>
            )}
          </div>
          <ToggleSwitch
            checked={coloredPath}
            onChange={() => toggleSetting('coloredPath')}
            label="Percorso colorato"
          />
        </div>
      </div>
    </div>
  );
}
