'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveItinerary, loadItineraries, isStorageNearLimit } from '@/lib/storage';
import { SavedItinerariesModal } from './SavedItinerariesModal';
import { exportItineraryJSON, importItineraryJSON } from '@/lib/export-json';

export function ItineraryHeader() {
  const store = useItineraryStore();
  const { itineraryId, itineraryName, waypoints, legs, setItineraryName, loadItinerary, resetItinerary } = store;
  const [showSaved, setShowSaved] = useState(false);
  const [createdAt] = useState(() => new Date().toISOString());

  const handleSave = () => {
    const existing = loadItineraries().find((it) => it.id === itineraryId);
    saveItinerary({
      id: itineraryId,
      name: itineraryName,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: new Date().toISOString(),
      waypoints,
      legs,
    });
    if (isStorageNearLimit()) {
      alert('Attenzione: lo spazio di archiviazione locale si sta esaurendo. Esporta i tuoi itinerari in JSON e cancella quelli vecchi.');
    }
  };

  const handleExportJSON = () => {
    exportItineraryJSON({ id: itineraryId, name: itineraryName, createdAt, updatedAt: new Date().toISOString(), waypoints, legs });
  };

  const handleImportJSON = () => {
    importItineraryJSON((itinerary) => {
      loadItinerary(itinerary.id, itinerary.name, itinerary.waypoints, itinerary.legs);
    });
  };

  return (
    <div className="border-b border-gray-700">
      <div className="p-3 flex items-center justify-between">
        <span className="text-lg font-bold text-green-400">&#9650; TrekTrak</span>
        <div className="flex gap-1">
          <button onClick={handleSave} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
            Salva
          </button>
          <button onClick={() => setShowSaved(true)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
            Carica
          </button>
          <button onClick={resetItinerary} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
            Nuovo
          </button>
          <button onClick={handleExportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Esporta JSON">
            ↓
          </button>
          <button onClick={handleImportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Importa JSON">
            ↑
          </button>
        </div>
      {showSaved && <SavedItinerariesModal onClose={() => setShowSaved(false)} />}
      </div>
      <div className="px-3 pb-3">
        <input
          type="text"
          value={itineraryName}
          onChange={(e) => setItineraryName(e.target.value)}
          placeholder="Nome itinerario..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
