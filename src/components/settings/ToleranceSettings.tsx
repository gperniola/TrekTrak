'use client';

import { useState, useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveSettings } from '@/lib/storage';
import type { ToleranceSettings as TolSettings } from '@/lib/types';

export function ToleranceSettings({ onClose }: { onClose: () => void }) {
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const [tol, setTol] = useState<TolSettings>({ ...settings.tolerances });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    const newSettings = { ...settings, tolerances: tol };
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-80" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-green-400 mb-4">Tolleranze di validazione</h3>
        <p className="text-xs text-gray-400 mb-4">
          Soglia stretta = valore impostato. Soglia larga = 2x il valore.
        </p>
        <div className="space-y-3">
          {fields.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-gray-300">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={tol[key]}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    if (Number.isFinite(num) && num > 0) setTol({ ...tol, [key]: num });
                  }}
                  min={0.01}
                  className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white text-right"
                />
                <span className="text-xs text-gray-500 w-10">{unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
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
