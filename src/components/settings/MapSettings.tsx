'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { saveSettings } from '@/lib/storage';
import { isRoutingAvailable } from '@/lib/routing-api';
import { useEffect } from 'react';
import { SAMPLE_INTERVAL_OPTIONS, BASE_MAPS } from '@/lib/types';
import type { SampleIntervalOption, BaseMapId } from '@/lib/types';

function ToggleSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
        disabled ? 'bg-gray-700 opacity-50 cursor-not-allowed' : checked ? 'bg-green-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
          checked && !disabled ? 'translate-x-5' : ''
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

  const toggleSetting = (key: 'coloredPath' | 'trailRouting' | 'showHikingTrails') => {
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

        {/* Base map selector */}
        <div className="py-3 border-t border-gray-700">
          <div className="text-sm text-gray-300 mb-1">Mappa di base</div>
          <div className="space-y-1">
            {BASE_MAPS.map((m) => (
              <label
                key={m.id}
                className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  settings.mapDisplay.baseMap === m.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                } ${!m.available ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="baseMap"
                  value={m.id}
                  checked={settings.mapDisplay.baseMap === m.id}
                  disabled={!m.available}
                  onChange={() => {
                    const newSettings = {
                      ...settings,
                      mapDisplay: { ...settings.mapDisplay, baseMap: m.id as BaseMapId },
                    };
                    updateSettings(newSettings);
                    saveSettings(newSettings);
                  }}
                  className="mt-0.5 accent-green-500"
                />
                <div>
                  <div className="text-xs text-gray-200">{m.label}</div>
                  <div className="text-[10px] text-gray-500">{m.description}</div>
                  {!m.available && <div className="text-[10px] text-red-400">API key richiesta</div>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Hiking trails overlay */}
        <div className="flex items-center justify-between py-3 border-t border-gray-700">
          <div>
            <div className="text-sm text-gray-300">Sentieri escursionistici</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Overlay Waymarked Trails — percorsi CAI, GR e sentieri ufficiali
            </div>
          </div>
          <ToggleSwitch
            checked={settings.mapDisplay.showHikingTrails}
            onChange={() => toggleSetting('showHikingTrails')}
            label="Sentieri escursionistici"
          />
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
            checked={trailRouting && orsAvailable}
            onChange={() => toggleSetting('trailRouting')}
            label="Percorso su sentiero"
            disabled={!orsAvailable}
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

        {/* Sample interval selector */}
        <div className="py-3 border-t border-gray-700">
          <div className="text-sm text-gray-300 mb-1">Campionatura altimetrica</div>
          <div className="text-[10px] text-gray-500 mb-2">
            Intervallo tra i punti di campionamento per il calcolo del profilo altimetrico.
            Valori bassi = più dettaglio, più lento. Valori alti = meno dettaglio, più veloce.
          </div>
          <select
            value={settings.mapDisplay.sampleInterval}
            onChange={(e) => {
              const val = Number(e.target.value) as SampleIntervalOption;
              const newSettings = {
                ...settings,
                mapDisplay: { ...settings.mapDisplay, sampleInterval: val },
              };
              updateSettings(newSettings);
              saveSettings(newSettings);
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-green-500 focus:outline-none"
            aria-label="Intervallo campionatura"
          >
            {SAMPLE_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
