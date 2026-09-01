'use client';

import { useState, useRef, useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { calculateDifficulty } from '@/lib/calculations';
import { formatTime } from '@/lib/format';
import type { DifficultyGrade } from '@/lib/types';
import { dislivello, km } from '@/lib/formato';
import { LIVELLI_SAC } from '@/lib/glossario';

function SacBadge({ grade }: { grade: DifficultyGrade }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        className="underline decoration-dotted underline-offset-2 text-gray-300 hover:text-white"
        aria-label={`Scala SAC: ${grade}. ${LIVELLI_SAC[grade]}. Clicca per dettagli`}
        aria-expanded={open}
      >
        {grade}
      </button>
      {open && (
        <div role="tooltip" className="absolute right-0 bottom-5 z-[1300] bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-[10px] text-gray-300 shadow-lg w-56 leading-snug">
          <div className="font-bold text-gray-100 mb-1">Scala SAC (Club Alpino Svizzero)</div>
          {(Object.keys(LIVELLI_SAC) as DifficultyGrade[]).map((g) => (
            <div key={g} className={g === grade ? 'text-green-400 font-medium' : ''}>
              <span className="font-mono">{g}</span> — {LIVELLI_SAC[g]}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

export function SummaryBar() {
  const legs = useItineraryStore((s) => s.legs);

  const totalDistance = legs.reduce((sum, l) => sum + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((sum, l) => sum + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((sum, l) => sum + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((sum, l) => sum + (l.estimatedTime ?? 0), 0);
  const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));
  const difficulty = calculateDifficulty(maxSlope);

  return (
    <div className="border-t border-gray-700 p-3 bg-gray-900">
      <div className="rounded-lg bg-gray-800/60 px-3 py-2">
        <div className="flex justify-between text-xs mb-1 tabular-nums font-semibold">
          <span className="text-gray-200">{km(totalDistance)}</span>
          <span className="text-red-400">{dislivello(totalGain, '+')}</span>
          <span className="text-blue-400">{dislivello(totalLoss, '−')}</span>
          <span className="text-gray-200">{formatTime(totalTime)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Difficolt&agrave;: <SacBadge grade={difficulty} /></span>
        </div>
      </div>
    </div>
  );
}
