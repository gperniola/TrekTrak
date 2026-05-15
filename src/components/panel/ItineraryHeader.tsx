'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveItinerary, isStorageNearLimit } from '@/lib/storage';
import { SavedItinerariesModal } from './SavedItinerariesModal';
import { exportItineraryJSON, importItineraryJSON } from '@/lib/export-json';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';

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
      saveItinerary({
        id: itineraryId,
        name: itineraryName,
        createdAt,
        updatedAt: new Date().toISOString(),
        waypoints: waypoints.map(({ validationState, ...wp }) => wp),
        // Strip derived fields and routeGeometry (large, can be re-fetched from ORS)
        legs: legs.map(({ validationState, estimatedTime, slope, routeGeometry, ...leg }) => leg),
      });
      toast.success('Itinerario salvato');
      if (isStorageNearLimit()) {
        toast.warning('Spazio di archiviazione quasi esaurito. Esporta in JSON i vecchi itinerari.', 6000);
      }
    } catch {
      toast.error('Errore nel salvataggio. Lo spazio potrebbe essere pieno.');
    }
  };

  const handleExportJSON = () => {
    exportItineraryJSON({
      id: itineraryId,
      name: itineraryName,
      createdAt,
      updatedAt: new Date().toISOString(),
      waypoints: waypoints.map(({ validationState, ...wp }) => wp),
      legs: legs.map(({ validationState, estimatedTime, slope, routeGeometry, ...leg }) => leg),
    });
  };

  const handleImportJSON = () => {
    importItineraryJSON(async (itinerary) => {
      const currentWps = useItineraryStore.getState().waypoints;
      if (currentWps.length > 0) {
        const ok = await appConfirm({
          title: 'Importare questo itinerario?',
          message: 'Le modifiche non salvate andranno perse.',
          confirmText: 'Importa',
        });
        if (!ok) return;
      }
      loadItinerary(itinerary.id, itinerary.name, itinerary.waypoints, itinerary.legs, itinerary.createdAt);
      toast.success('Itinerario importato');
    });
  };

  return (
    <div className="border-b border-gray-700">
      <div className="p-3 flex items-center justify-end gap-1">
        <button onClick={handleSave} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" aria-label="Salva itinerario">
          Salva
        </button>
        <button onClick={() => setShowSaved(true)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" aria-label="Carica itinerario">
          Carica
        </button>
        <button
          onClick={async () => {
            if (waypoints.length > 0) {
              const ok = await appConfirm({
                title: 'Creare un nuovo itinerario?',
                message: 'Le modifiche non salvate andranno perse.',
                confirmText: 'Crea nuovo',
              });
              if (!ok) return;
            }
            resetItinerary();
            toast.info('Nuovo itinerario creato');
          }}
          className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600"
          aria-label="Nuovo itinerario"
        >
          Nuovo
        </button>
        <button onClick={handleExportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Esporta JSON" aria-label="Esporta JSON">
          ↓
        </button>
        <button onClick={handleImportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Importa JSON" aria-label="Importa JSON">
          ↑
        </button>
      </div>
      <div className="px-3 pb-3">
        <input
          type="text"
          name="itineraryName"
          value={itineraryName}
          onChange={(e) => setItineraryName(e.target.value)}
          maxLength={200}
          placeholder="Nome itinerario..."
          aria-label="Nome itinerario"
          autoComplete="off"
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
        />
      </div>
      {showSaved && <SavedItinerariesModal onClose={() => setShowSaved(false)} />}
    </div>
  );
}
