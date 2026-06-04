'use client';

import { useState } from 'react';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { exportItineraryJSON } from '@/lib/export-json';
import { formatTime } from '@/lib/format';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';
import { CompletionList } from './CompletionList';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 rounded px-2 py-1.5">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function RouteDetailCard() {
  const routes = useRouteLibraryStore((s) => s.routes);
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  const updateNotes = useRouteLibraryStore((s) => s.updateNotes);
  const remove = useRouteLibraryStore((s) => s.remove);
  const loadItinerary = useItineraryStore((s) => s.loadItinerary);
  const setMainView = useUIStore((s) => s.setMainView);
  const route = routes.find((r) => r.id === selectedId);
  const [notes, setNotes] = useState(route?.notes ?? '');

  if (!route) return null;
  const m = route.metrics;

  const handleLoad = async () => {
    const currentWps = useItineraryStore.getState().waypoints;
    if (currentWps.length > 0) {
      const ok = await appConfirm({
        title: 'Caricare questo percorso?',
        message: "Le modifiche non salvate nell'editor andranno perse.",
        confirmText: 'Carica',
      });
      if (!ok) return;
    }
    loadItinerary(route.id, route.name, route.waypoints, route.legs, route.createdAt);
    setMainView('editor');
  };

  const handleDelete = async () => {
    const ok = await appConfirm({
      title: 'Eliminare questo percorso?',
      message: "L'azione è irreversibile.",
      variant: 'error',
      confirmText: 'Elimina',
    });
    if (!ok) return;
    remove(route.id);
    toast.success('Percorso eliminato');
  };

  const handleNotesBlur = () => {
    if (notes === (route.notes ?? '')) return;
    try {
      updateNotes(route.id, notes);
    } catch {
      toast.error('Errore nel salvataggio. Lo spazio potrebbe essere pieno.');
    }
  };

  return (
    <div className="border-t border-gray-700 p-3 space-y-3">
      <h3 className="text-base font-bold text-green-400">{route.name || 'Senza nome'}</h3>
      {m && (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Distanza" value={`${m.distanceKm.toFixed(1)} km`} />
          <Stat label="Stima" value={formatTime(m.estimatedTimeMin)} />
          <Stat label="Dislivello +" value={`+${m.elevationGain} m`} />
          <Stat label="Dislivello -" value={`-${m.elevationLoss} m`} />
          <Stat label="Alt. min" value={m.minAltitude != null ? `${m.minAltitude} m` : '—'} />
          <Stat label="Alt. max" value={m.maxAltitude != null ? `${m.maxAltitude} m` : '—'} />
          <Stat label="Pend. media" value={`${m.avgSlope.toFixed(1)}%`} />
          <Stat label="Pend. max" value={`${m.maxSlope.toFixed(1)}%`} />
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-400 mb-1" htmlFor="route-notes">Note del percorso</label>
        <textarea
          id="route-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={2}
          maxLength={2000}
          placeholder="Aggiungi note..."
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none resize-none"
        />
      </div>
      <CompletionList route={route} />
      <div className="flex gap-2">
        <button
          onClick={handleLoad}
          className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-gray-950 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-[0.98] hover:from-green-400 hover:to-emerald-500"
        >
          Carica nell&apos;editor
        </button>
        <button
          onClick={() => exportItineraryJSON(route)}
          className="px-3 py-2 bg-gray-700 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-gray-600"
          aria-label="Esporta JSON"
        >
          ↓
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-2 bg-red-600 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-red-500"
        >
          Elimina
        </button>
      </div>
    </div>
  );
}
