'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveItinerary, loadItineraries, isStorageNearLimit } from '@/lib/storage';
import { SavedItinerariesModal } from './SavedItinerariesModal';
import { exportItineraryJSON, importItineraryJSON } from '@/lib/export-json';

export function ItineraryHeader() {
  const itineraryId = useItineraryStore((s) => s.itineraryId);
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const createdAt = useItineraryStore((s) => s.createdAt);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const setItineraryName = useItineraryStore((s) => s.setItineraryName);
  const loadItinerary = useItineraryStore((s) => s.loadItinerary);
  const resetItinerary = useItineraryStore((s) => s.resetItinerary);
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = () => {
    try {
      const existing = loadItineraries().find((it) => it.id === itineraryId);
      saveItinerary({
        id: itineraryId,
        name: itineraryName,
        createdAt: existing?.createdAt ?? createdAt,
        updatedAt: new Date().toISOString(),
        waypoints: waypoints.map(({ validationState, ...wp }) => wp),
        legs: legs.map(({ validationState, estimatedTime, slope, ...leg }) => leg),
      });
      if (isStorageNearLimit()) {
        alert('Attenzione: lo spazio di archiviazione locale si sta esaurendo. Esporta i tuoi itinerari in JSON e cancella quelli vecchi.');
      }
    } catch {
      alert('Errore nel salvataggio. Lo spazio di archiviazione potrebbe essere pieno.');
    }
  };

  const handleExportJSON = () => {
    exportItineraryJSON({
      id: itineraryId,
      name: itineraryName,
      createdAt,
      updatedAt: new Date().toISOString(),
      waypoints: waypoints.map(({ validationState, ...wp }) => wp),
      legs: legs.map(({ validationState, estimatedTime, slope, ...leg }) => leg),
    });
  };

  const handleImportJSON = () => {
    importItineraryJSON((itinerary) => {
      const currentWps = useItineraryStore.getState().waypoints;
      if (currentWps.length > 0 && !confirm('Importare questo itinerario? Le modifiche non salvate andranno perse.')) return;
      loadItinerary(itinerary.id, itinerary.name, itinerary.waypoints, itinerary.legs, itinerary.createdAt);
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
          <button
            onClick={() => {
              if (waypoints.length === 0 || confirm('Creare un nuovo itinerario? Le modifiche non salvate andranno perse.')) {
                resetItinerary();
              }
            }}
            className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600"
          >
            Nuovo
          </button>
          <button onClick={handleExportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Esporta JSON">
            ↓
          </button>
          <button onClick={handleImportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Importa JSON">
            ↑
          </button>
        </div>
      </div>
      <div className="px-3 pb-3">
        <input
          type="text"
          value={itineraryName}
          onChange={(e) => setItineraryName(e.target.value)}
          maxLength={200}
          placeholder="Nome itinerario..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
        />
      </div>
      {showSaved && <SavedItinerariesModal onClose={() => setShowSaved(false)} />}
    </div>
  );
}
