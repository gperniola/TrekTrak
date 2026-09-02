'use client';

import { useState } from 'react';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { exportItineraryJSON } from '@/lib/export-json';
import { formatTime } from '@/lib/format';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';
import { CompletionList } from './CompletionList';
import { buildMeteoUrl } from '@/lib/meteo';
import { km, metri, percento } from '@/lib/formato';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 rounded px-2 py-1.5">
      <div className="text-[10px] text-gray-400 uppercase">{label}</div>
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
  const member = useAuthStore((s) => s.member);
  const route = routes.find((r) => r.id === selectedId);
  const [notes, setNotes] = useState(route?.notes ?? '');

  if (!route) return null;
  const m = route.metrics;
  // Solo il proprietario (o un admin) può eliminare il percorso.
  const canManageRoute = member?.role === 'admin' || route.createdByUsername === member?.username;

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
    const n = route.completions?.length ?? 0;
    const ok = await appConfirm({
      title: 'Eliminare questo percorso?',
      message: n > 0
        ? `Verranno eliminati anche i ${n} completament${n === 1 ? 'o' : 'i'} associati. L'azione è irreversibile.`
        : "L'azione è irreversibile.",
      variant: 'error',
      confirmText: 'Elimina',
    });
    if (!ok) return;
    try { await remove(route.id); toast.success('Percorso eliminato'); }
    catch { toast.error('Errore di rete. Riprova quando sei online.'); }
  };

  const handleNotesBlur = async () => {
    if (notes === (route.notes ?? '')) return;
    try { await updateNotes(route.id, notes); }
    catch { toast.error('Errore nel salvataggio. Riprova quando sei online.'); }
  };

  const handlePDF = async () => {
    if (route.waypoints.length < 2) { toast.warning('Servono almeno 2 waypoint'); return; }
    const { downloadPDF } = await import('@/lib/export-pdf');
    const { calculateDifficulty } = await import('@/lib/calculations');
    downloadPDF({
      name: route.name,
      waypoints: route.waypoints,
      legs: route.legs,
      totalDistance: m?.distanceKm ?? 0,
      totalElevGain: m?.elevationGain ?? 0,
      totalElevLoss: m?.elevationLoss ?? 0,
      totalTime: m?.estimatedTimeMin ?? 0,
      difficulty: calculateDifficulty(m?.maxSlope ?? 0),
    }, 'summary');
  };

  return (
    <div className="border-t border-gray-700 p-3 space-y-3">
      <h3 className="text-base font-bold text-green-400">{route.name || 'Senza nome'}</h3>
      {route.createdByUsername && (
        <p className="text-xs text-gray-400">creato da <span className="text-green-400">@{route.createdByUsername}</span></p>
      )}
      {m && (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Distanza" value={km(m.distanceKm)} />
          <Stat label="Stima" value={formatTime(m.estimatedTimeMin)} />
          <Stat label="Dislivello +" value={`+${metri(m.elevationGain)}`} />
          <Stat label="Dislivello -" value={`-${metri(m.elevationLoss)}`} />
          <Stat label="Alt. min" value={m.minAltitude != null ? metri(m.minAltitude) : '—'} />
          <Stat label="Alt. max" value={m.maxAltitude != null ? metri(m.maxAltitude) : '—'} />
          <Stat label="Pend. media" value={percento(m.avgSlope)} />
          <Stat label="Pend. max" value={percento(m.maxSlope)} />
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
      <div>
        <h4 className="text-xs font-semibold text-gray-400 mb-1">Diario uscite</h4>
        <CompletionList route={route} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleLoad}
          className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-black rounded-lg text-xs font-bold shadow-sm transition-all active:scale-[0.98] hover:from-green-400 hover:to-emerald-500 max-lg:min-h-[44px]"
        >
          Carica nell&apos;editor
        </button>
        <button onClick={handlePDF} className="px-3 py-2 bg-green-500 text-black rounded-lg text-xs font-bold transition-all active:scale-[0.97] hover:bg-green-400 max-lg:min-h-[44px]" aria-label="Scarica PDF">PDF</button>
        {(() => { const u = buildMeteoUrl(route.waypoints); return u ? (
          <button onClick={() => window.open(u, '_blank')} className="px-3 py-2 bg-cyan-600 text-black rounded-lg text-xs font-bold transition-all active:scale-[0.97] hover:bg-cyan-500 max-lg:min-h-[44px]" aria-label="Meteo">Meteo</button>
        ) : null; })()}
        <button
          onClick={() => exportItineraryJSON(route)}
          className="px-3 py-2 bg-gray-700 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-gray-600 max-lg:min-h-[44px]"
          aria-label="Esporta JSON"
        >
          ↓
        </button>
        {canManageRoute && (
          <button
            onClick={handleDelete}
            className="px-3 py-2 bg-red-600 rounded-lg text-xs transition-all active:scale-[0.97] hover:bg-red-500 max-lg:min-h-[44px]"
          >
            Elimina
          </button>
        )}
      </div>
    </div>
  );
}
