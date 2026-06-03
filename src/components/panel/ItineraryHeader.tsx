'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveItinerary, loadItineraries, isStorageNearLimit } from '@/lib/storage';
import { computeRouteMetrics } from '@/lib/calculations';
import { SaveRouteModal } from './SaveRouteModal';
import { exportItineraryJSON, importItineraryJSON } from '@/lib/export-json';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import type { Leg } from '@/lib/types';

export function ItineraryHeader() {
  const itineraryId = useItineraryStore((s) => s.itineraryId);
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const createdAt = useItineraryStore((s) => s.createdAt);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const settings = useItineraryStore((s) => s.settings);
  const setItineraryName = useItineraryStore((s) => s.setItineraryName);
  const loadItinerary = useItineraryStore((s) => s.loadItinerary);
  const resetItinerary = useItineraryStore((s) => s.resetItinerary);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const setMainView = useUIStore((s) => s.setMainView);
  const refreshLibrary = useRouteLibraryStore((s) => s.refresh);

  // Strip large/derived fields before persisting (storage and JSON export).
  // - validationState, estimatedTime, slope: derived (recomputed on load)
  // - routeGeometry, elevationProfile: large (regenerable via ORS/DEM)
  // - trackValues.routeGeometry, trackValues.elevationProfile: same as above
  const slimLeg = (leg: Leg) => {
    const { validationState, estimatedTime, slope, routeGeometry, elevationProfile, trackValues, ...rest } = leg;
    void validationState; void estimatedTime; void slope; void routeGeometry; void elevationProfile;
    const slimTrack = trackValues
      ? (() => {
          const { routeGeometry: _rg, elevationProfile: _ep, ...tv } = trackValues;
          void _rg; void _ep;
          return tv;
        })()
      : undefined;
    return slimTrack ? { ...rest, trackValues: slimTrack } : rest;
  };

  const persist = (name: string, notes: string | undefined) => {
    const existing = loadItineraries().find((it) => it.id === itineraryId);
    const metrics = computeRouteMetrics(waypoints, legs, settings.pace?.factor ?? 1);
    const maxSort = loadItineraries().reduce((m, it) => Math.max(m, it.sortIndex ?? 0), -1);
    try {
      saveItinerary({
        id: itineraryId,
        name,
        createdAt,
        updatedAt: new Date().toISOString(),
        waypoints: waypoints.map(({ validationState, ...wp }) => wp),
        legs: legs.map(slimLeg),
        metrics,
        notes: notes ?? existing?.notes ?? '',
        completions: existing?.completions ?? [],
        sortIndex: existing?.sortIndex ?? maxSort + 1,
      });
      if (name !== itineraryName) setItineraryName(name);
      refreshLibrary();
      toast.success('Itinerario salvato');
      if (isStorageNearLimit()) {
        toast.warning('Spazio di archiviazione quasi esaurito. Esporta in JSON i vecchi itinerari.', 6000);
      }
    } catch {
      toast.error('Errore nel salvataggio. Lo spazio potrebbe essere pieno.');
    }
  };

  const handleSave = () => {
    const existing = loadItineraries().find((it) => it.id === itineraryId);
    if (existing) {
      persist(itineraryName || existing.name, undefined);
    } else {
      setShowSaveModal(true);
    }
  };

  const handleExportJSON = () => {
    exportItineraryJSON({
      id: itineraryId,
      name: itineraryName,
      createdAt,
      updatedAt: new Date().toISOString(),
      waypoints: waypoints.map(({ validationState, ...wp }) => wp),
      legs: legs.map(slimLeg),
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
        <button onClick={() => setMainView('library')} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" aria-label="Apri libreria percorsi">
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
      {showSaveModal && (
        <SaveRouteModal
          initialName={itineraryName}
          onClose={() => setShowSaveModal(false)}
          onConfirm={(name, notes) => { persist(name, notes); setShowSaveModal(false); }}
        />
      )}
    </div>
  );
}
