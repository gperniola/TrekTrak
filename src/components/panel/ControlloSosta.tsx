'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { durataMin } from '@/lib/formato';

/** Gli stessi incrementi del pulsante sulla mappa: 15, 30, un'ora. */
const INCREMENTI: { min: number; testo: string }[] = [
  { min: 15, testo: '15 min' },
  { min: 30, testo: '30 min' },
  { min: 60, testo: '1 ora' },
];

/**
 * **La sosta a un waypoint, mostrata e modificabile nella lista dell'Editor.**
 *
 * Chiesto: la pausa «viene conteggiata e rappresentata nella lista waypoint». Sulla mappa
 * il pulsante agisce solo sull'ultimo punto; qui si ritocca la sosta di **qualunque**
 * punto, con gli stessi incrementi che si sommano. Il valore corrente è sempre a vista,
 * così una sosta impostata per sbaglio si nota e si azzera.
 */
export function ControlloSosta({ id, pausaMin }: { id: string; pausaMin?: number }) {
  const imposta = useItineraryStore((s) => s.impostaPausaWaypoint);
  const pausa = pausaMin ?? 0;

  return (
    <div className="flex items-center flex-wrap gap-1 text-[11px]">
      <span className="text-gray-400">
        <span aria-hidden>⏸</span> Sosta
      </span>
      <span className={`font-medium tabular-nums ${pausa > 0 ? 'text-amber-300' : 'text-gray-400'}`}>
        {pausa > 0 ? durataMin(pausa) : 'nessuna'}
      </span>
      <span className="flex items-center gap-1 ml-auto">
        {INCREMENTI.map(({ min, testo }) => (
          <button
            key={min}
            onClick={() => imposta(id, pausa + min)}
            className="px-1.5 py-0.5 min-h-[28px] rounded bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors"
            aria-label={`Aggiungi ${testo} di sosta`}
          >
            +{min >= 60 ? '1h' : min}
          </button>
        ))}
        {pausa > 0 && (
          <button
            onClick={() => imposta(id, 0)}
            className="px-1.5 py-0.5 min-h-[28px] rounded text-gray-400 hover:text-red-300 transition-colors"
            aria-label="Azzera la sosta"
            title="Azzera la sosta"
          >
            ✕
          </button>
        )}
      </span>
    </div>
  );
}
