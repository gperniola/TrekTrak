'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveRouteToCloud } from '@/lib/sync';
import { computeRouteMetrics } from '@/lib/calculations';
import { SaveRouteModal } from './SaveRouteModal';
import { exportItineraryJSON, importItineraryJSON } from '@/lib/export-json';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';
import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useAuthStore } from '@/stores/authStore';
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
  const member = useAuthStore((s) => s.member);

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

  // Per il cloud manteniamo routeGeometry + elevationProfile (fedeltà del sentiero
  // tracciato), inclusi quelli dentro trackValues; rimuoviamo solo i derivati
  // ricalcolabili al load (validationState/estimatedTime/slope).
  const cloudLeg = (leg: Leg) => {
    const { validationState, estimatedTime, slope, ...rest } = leg;
    void validationState; void estimatedTime; void slope;
    return rest;
  };

  const persist = async (name: string, notes: string | undefined) => {
    if (!member) return;
    const metrics = computeRouteMetrics(waypoints, legs, settings.pace?.factor ?? 1);
    const existing = useRouteLibraryStore.getState().routes.find((r) => r.id === itineraryId);
    const itinerary = {
      id: itineraryId,
      name,
      createdAt,
      updatedAt: new Date().toISOString(),
      waypoints: waypoints.map(({ validationState, ...wp }) => wp),
      legs: legs.map(cloudLeg),
      metrics,
      notes: notes ?? existing?.notes ?? '',
    } as Parameters<typeof saveRouteToCloud>[0];
    try {
      const newId = await saveRouteToCloud(itinerary, member.id);
      if (newId !== itineraryId) useItineraryStore.getState().setItineraryId(newId);
      if (name !== itineraryName) setItineraryName(name);
      await useRouteLibraryStore.getState().refresh();
      toast.success('Percorso salvato nella libreria');
    } catch {
      toast.error('Errore nel salvataggio. Riprova quando sei online.');
    }
  };

  const handleSave = () => {
    if (!member) { toast.warning('Accedi alla libreria condivisa per salvare i percorsi'); return; }
    const existing = useRouteLibraryStore.getState().routes.find((r) => r.id === itineraryId);
    if (existing) void persist(itineraryName || existing.name, undefined);
    else setShowSaveModal(true);
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
        <button
          onClick={handleSave}
          disabled={!member}
          title={!member ? 'Accedi alla libreria condivisa per salvare' : undefined}
          className={member
            ? 'px-2.5 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-gray-950 font-semibold rounded-lg text-xs shadow-sm transition-all active:scale-[0.97] hover:from-green-400 hover:to-emerald-500'
            : 'px-2.5 py-1 bg-gray-700/60 text-gray-500 rounded-lg text-xs cursor-not-allowed'}
          aria-label="Salva itinerario"
        >
          Salva
        </button>
        <button onClick={() => setMainView('library')} className="px-2 py-1 bg-gray-700 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-gray-600" aria-label="Apri libreria percorsi">
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
          className="px-2 py-1 bg-gray-700 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-gray-600"
          aria-label="Nuovo itinerario"
        >
          Nuovo
        </button>
        <button onClick={handleExportJSON} className="px-2 py-1 bg-gray-700 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-gray-600" title="Esporta JSON" aria-label="Esporta JSON">
          ↓
        </button>
        <button onClick={handleImportJSON} className="px-2 py-1 bg-gray-700 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-gray-600" title="Importa JSON" aria-label="Importa JSON">
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
          onConfirm={(name, notes) => { void persist(name, notes); setShowSaveModal(false); }}
        />
      )}
    </div>
  );
}
