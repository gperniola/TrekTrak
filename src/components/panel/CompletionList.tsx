'use client';

import { useState } from 'react';
import type { Itinerary, RouteCompletion } from '@/lib/types';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/lib/format';
import { toast } from '@/stores/notificationStore';
import { CompletionForm } from './CompletionForm';
import { DifficultyRating } from './DifficultyRating';

function fmtDate(iso: string): string {
  const d = Date.parse(iso);
  return Number.isNaN(d) ? iso : new Date(d).toLocaleDateString('it-IT');
}

function deltaLabel(actual: number, estimate: number): string {
  const diff = Math.round(actual - estimate);
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  return `stima ${formatTime(estimate)} → ${sign}${formatTime(Math.abs(diff))}`;
}

export function CompletionList({ route }: { route: Itinerary }) {
  const addCompletion = useRouteLibraryStore((s) => s.addCompletion);
  const updateCompletion = useRouteLibraryStore((s) => s.updateCompletion);
  const deleteCompletion = useRouteLibraryStore((s) => s.deleteCompletion);
  const member = useAuthStore((s) => s.member);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const completions = route.completions ?? [];
  const estimate = route.metrics?.estimatedTimeMin;

  const lastDate = completions.length
    ? completions.map((c) => c.date).sort().at(-1)
    : null;

  const guard = async (fn: () => Promise<void>) => {
    try { await fn(); } catch { toast.error('Errore nel salvataggio. Riprova quando sei online.'); }
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
          onCancel={() => setAdding(false)}
          onSubmit={(c) => { void guard(() => addCompletion(route.id, { ...c, personName: member?.username ?? '' })); setAdding(false); }}
        />
      )}

      <div className="space-y-1">
        {completions.map((c: RouteCompletion) => (
          editingId === c.id ? (
            <CompletionForm key={c.id} idPrefix={`cf-edit-${c.id}`} initial={c}
              onCancel={() => setEditingId(null)}
              onSubmit={(patch) => { void guard(() => updateCompletion(route.id, c.id, patch)); setEditingId(null); }} />
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
                  <button onClick={() => void guard(() => deleteCompletion(route.id, c.id))} className="text-gray-500 hover:text-red-400" aria-label="Elimina completamento">✕</button>
                </div>
              </div>
              {c.difficulty != null && (
                <div className="mt-0.5">
                  <DifficultyRating value={c.difficulty} readOnly />
                </div>
              )}
              {c.notes && <div className="text-gray-500 mt-0.5">{c.notes}</div>}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
