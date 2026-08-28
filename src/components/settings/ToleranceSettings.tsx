'use client';

import { useState, useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveSettings, KEYS } from '@/lib/storage';
import { toast } from '@/stores/notificationStore';
import { parseDecimale } from '@/components/shared/NumberInput';
import { DEFAULT_PACE } from '@/lib/types';
import type { ToleranceSettings as TolSettings } from '@/lib/types';
import { numero } from '@/lib/formato';

export function ToleranceSettings({ onClose }: { onClose: () => void }) {
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const [tol, setTol] = useState<TolSettings>({ ...settings.tolerances });
  /**
   * Il testo battuto, separato dal numero: mentre si scrive "0,00" non c'e' ancora un
   * valore valido, ma quello che si sta digitando deve restare a schermo.
   */
  const [testi, setTesti] = useState<Partial<Record<keyof TolSettings, string>>>({});
  const [paceFactor, setPaceFactor] = useState<number>(settings.pace?.factor ?? DEFAULT_PACE.factor);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    const newSettings = { ...settings, tolerances: tol, pace: { factor: paceFactor } };
    updateSettings(newSettings);
    saveSettings(newSettings);
    onClose();
  };

  const fields: { key: keyof TolSettings; label: string; unit: string }[] = [
    { key: 'altitude', label: 'Altitudine', unit: 'm' },
    { key: 'coordinates', label: 'Coordinate', unit: 'gradi' },
    { key: 'distance', label: 'Distanza', unit: '%' },
    { key: 'azimuth', label: 'Azimuth', unit: '°' },
    { key: 'elevationDelta', label: 'Dislivello', unit: '%' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200]" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-80 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-green-400 mb-4">Tolleranze di validazione</h3>
        <p className="text-xs text-gray-400 mb-4">
          Soglia stretta = valore impostato. Soglia larga = 2x il valore.
        </p>
        <div className="space-y-3">
          {fields.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-gray-300">{label}</label>
              <div className="flex items-center gap-1">
                {/*
                  Di testo con tastiera decimale, non `type="number"`: la tolleranza
                  delle coordinate vale 0,001 gradi, e col campo numerico la virgola
                  veniva scartata dal browser — quindi all'italiana non era
                  impostabile. Stesso difetto corretto nei campi dell'itinerario.
                */}
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={testi[key] ?? String(tol[key])}
                  onChange={(e) => {
                    const grezzo = e.target.value;
                    setTesti({ ...testi, [key]: grezzo });
                    const num = parseDecimale(grezzo);
                    if (num != null && num > 0) setTol({ ...tol, [key]: num });
                  }}
                  aria-label={`Tolleranza ${label} in ${unit}`}
                  className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white text-right max-lg:min-h-[44px]"
                />
                <span className="text-xs text-gray-500 w-10">{unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-700 mt-5 pt-4">
          <div className="text-sm font-medium text-gray-300 mb-2">Passo personale (Munter)</div>
          <p className="text-[10px] text-gray-500 mb-2">
            Moltiplicatore del tempo di percorrenza standard (4 km/h orizzontale).
          </p>
          <input
            type="range"
            min="0.7" max="1.5" step="0.05"
            value={paceFactor}
            onChange={(e) => setPaceFactor(Number(e.target.value))}
            className="w-full accent-green-500"
            aria-label="Passo personale"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0.7× corridore</span>
            <span className="text-green-400 font-bold">{numero(paceFactor, 2)}×</span>
            <span>1.5× pesante</span>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-5 pt-4">
          <button
            onClick={() => {
              try {
                localStorage.removeItem(KEYS.tutorialSeen);
                toast.info('Tutorial verrà mostrato al prossimo riavvio dell\'app');
              } catch {
                toast.error('Impossibile resettare il tutorial');
              }
            }}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded"
          >
            Rivedi tutorial al prossimo avvio
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">
            Annulla
          </button>
          <button onClick={handleSave} className="flex-1 py-2 bg-green-500 text-black rounded text-sm font-bold hover:bg-green-400">
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
