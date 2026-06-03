'use client';

import { useState } from 'react';
import type { Itinerary, RouteCompletion } from '@/lib/types';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { getKnownPeople } from '@/lib/storage';
import { formatTime } from '@/lib/format';
import { toast } from '@/stores/notificationStore';
import { CompletionForm } from './CompletionForm';

function fmtDate(iso: string): string {
  const d = Date.parse(iso);
  return Number.isNaN(d) ? iso : new Date(d).toLocaleDateString('it-IT');
}

function deltaLabel(actual: number, estimate: number): string {
  const diff = Math.round(actual - estimate);
  const sign = diff > 0 ? '+' : '';
  return `stima ${formatTime(estimate)} → ${sign}${diff}m`;
}

const SAVE_ERR = 'Errore nel salvataggio. Lo spazio potrebbe essere pieno.';

export function CompletionList({ route }: { route: Itinerary }) {
  const addCompletion = useRouteLibraryStore((s) => s.addCompletion);
  const updateCompletion = useRouteLibraryStore((s) => s.updateCompletion);
  const deleteCompletion = useRouteLibraryStore((s) => s.deleteCompletion);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const completions = route.completions ?? [];
  const estimate = route.metrics?.estimatedTimeMin;

  const lastDate = completions.length
    ? completions.map((c) => c.date).sort().at(-1)
    : null;

  const guard = (fn: () => void) => {
    try { fn(); } catch { toast.error(SAVE_ERR); }
  };

  return (
    <div className="border-t border-gray-700 pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">🥾 {completions.length} completament{completions.length === 1 ? 'o' : 'i'}{lastDate ? ` · ultima ${fmtDate(lastDate)}` : ''}</span>
        {!adding && editingId === null && (
          <button onClick={() => setAdding(true)} className="text-xs text-green-400 hover:text-green-300">+ Aggiungi</button>
        )}
      </div>

      {adding && (
        <CompletionForm
          idPrefix="cf-add"
          knownPeople={getKnownPeople()}
          onCancel={() => setAdding(false)}
          onSubmit={(c) => { guard(() => addCompletion(route.id, c)); setAdding(false); }}
        />
      )}

      <div className="space-y-1">
        {completions.map((c: RouteCompletion) => (
          editingId === c.id ? (
            <CompletionForm key={c.id} idPrefix={`cf-edit-${c.id}`} knownPeople={getKnownPeople()} initial={c}
              onCancel={() => setEditingId(null)}
              onSubmit={(patch) => { guard(() => updateCompletion(route.id, c.id, patch)); setEditingId(null); }} />
          ) : (
            <div key={c.id} className="bg-gray-900 rounded px-2 py-1.5 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium">{c.personName}</span>
                  <span className="text-gray-500"> · {fmtDate(c.date)}</span>
                  {c.durationMinutes != null && (
                    <span className="text-gray-400"> · {formatTime(c.durationMinutes)}
                      {estimate != null && <span className="text-gray-600"> ({deltaLabel(c.durationMinutes, estimate)})</span>}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditingId(c.id)} className="text-gray-500 hover:text-gray-300" aria-label="Modifica completamento">✎</button>
                  <button onClick={() => guard(() => deleteCompletion(route.id, c.id))} className="text-gray-500 hover:text-red-400" aria-label="Elimina completamento">✕</button>
                </div>
              </div>
              {c.notes && <div className="text-gray-500 mt-0.5">{c.notes}</div>}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
