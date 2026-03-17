'use client';

import { useState, useEffect } from 'react';
import { loadItineraries, deleteItinerary } from '@/lib/storage';
import { useItineraryStore } from '@/stores/itineraryStore';

export function SavedItinerariesModal({ onClose }: { onClose: () => void }) {
  const loadItinerary = useItineraryStore((s) => s.loadItinerary);
  const [items, setItems] = useState(() => loadItineraries());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleLoad = (it: typeof items[0]) => {
    const currentWps = useItineraryStore.getState().waypoints;
    if (currentWps.length > 0 && !confirm('Caricare questo itinerario? Le modifiche non salvate andranno perse.')) return;
    loadItinerary(it.id, it.name, it.waypoints, it.legs, it.createdAt);
    onClose();
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminare questo itinerario?')) {
      deleteItinerary(id);
      setItems(loadItineraries());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200]" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 w-96 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-green-400 mb-4">Itinerari salvati</h3>
        {items.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun itinerario salvato</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {items.map((it) => (
              <div key={it.id} className="bg-gray-900 rounded p-3 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{it.name || 'Senza nome'}</div>
                  <div className="text-xs text-gray-500">
                    {it.waypoints.length} waypoint | {new Date(it.updatedAt).toLocaleDateString('it-IT')}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleLoad(it)} className="px-2 py-1 bg-green-600 rounded text-xs hover:bg-green-500">
                    Carica
                  </button>
                  <button onClick={() => handleDelete(it.id)} className="px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-500">
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-4 w-full py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">
          Chiudi
        </button>
      </div>
    </div>
  );
}
