'use client';

import { useState, useRef, useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { durataMin } from '@/lib/formato';
import { useMapOverlayGuard } from './useMapOverlayGuard';

/** Gli incrementi offerti, in minuti. Scelti dall'utente: 15, 30, un'ora. */
const INCREMENTI: { min: number; etichetta: string }[] = [
  { min: 15, etichetta: '15 min' },
  { min: 30, etichetta: '30 min' },
  { min: 60, etichetta: '1 ora' },
];

/**
 * **Aggiunge una sosta all'ultimo punto messo, dove lo si è messo.**
 *
 * La pausa è del passaggio, non del posto: sposta in avanti gli orari di arrivo ai punti
 * successivi e conta nel tempo totale (la logica sta in `route-weather` e nelle metriche).
 * Qui c'è solo il gesto: un popover con tre incrementi — 15 min, 30 min, 1 ora — che si
 * **sommano** a ogni tocco, come chiesto («cliccando più volte si aumenta per
 * incrementi»). Così una sosta pranzo di un'ora e un quarto sono un tocco su «1 ora» più
 * uno su «15 min», senza tastierino.
 *
 * Agisce sull'**ultimo** waypoint: è «quel punto» che si è appena piazzato. Le soste dei
 * punti intermedi si ritoccano dalla lista dell'Editor, dove ogni punto ha il suo campo.
 *
 * Compare da un waypoint in su; il badge mostra la sosta già impostata, così si sa a colpo
 * d'occhio se e quanto ci si ferma lì.
 */
export function PulsantePausa() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const impostaPausa = useItineraryStore((s) => s.impostaPausaWaypoint);
  const guardiaPulsante = useMapOverlayGuard<HTMLButtonElement>();
  const guardiaPopover = useMapOverlayGuard<HTMLDivElement>();
  const [aperto, setAperto] = useState(false);
  // Chiudi il popover quando l'ultimo punto sparisce da sotto (cancellato altrove).
  const nWp = waypoints.length;
  const prevN = useRef(nWp);
  useEffect(() => {
    if (nWp < prevN.current && nWp === 0) setAperto(false);
    prevN.current = nWp;
  }, [nWp]);

  if (nWp === 0) return null;

  const ultimo = waypoints[nWp - 1];
  const pausa = ultimo.pausaMin ?? 0;

  const aggiungi = (min: number) => impostaPausa(ultimo.id, pausa + min);
  const azzera = () => impostaPausa(ultimo.id, 0);

  return (
    <>
      <button
        ref={guardiaPulsante}
        onClick={() => setAperto((v) => !v)}
        aria-label={
          pausa > 0
            ? `Sosta all'ultimo punto: ${durataMin(pausa)}. Tocca per cambiarla`
            : 'Aggiungi una sosta all\u2019ultimo punto'
        }
        aria-expanded={aperto}
        title="Sosta all'ultimo punto"
        className="absolute bottom-64 right-3 z-[1000] w-10 h-10 max-lg:w-11 max-lg:h-11 rounded-full shadow-lg flex items-center justify-center text-lg
                   bg-gray-800/90 text-amber-300 hover:bg-gray-700 transition-colors
                   focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
      >
        ⏸️
        {pausa > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center tabular-nums">
            {pausa >= 60 ? `${Math.floor(pausa / 60)}h` : pausa}
          </span>
        )}
      </button>

      {aperto && (
        <div
          ref={guardiaPopover}
          role="group"
          aria-label="Sosta all'ultimo punto"
          className="absolute bottom-64 right-14 z-[1000] w-52 bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Sosta qui</span>
            <button
              onClick={() => setAperto(false)}
              className="text-gray-400 hover:text-white text-xs leading-none ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center -my-2 -mr-2"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-300 mb-2 truncate" title={ultimo.name || undefined}>
            {ultimo.name || 'Ultimo punto'}
          </p>
          <div
            aria-live="polite"
            className={`text-center text-sm font-bold mb-2 ${pausa > 0 ? 'text-amber-300' : 'text-gray-400'}`}
          >
            {pausa > 0 ? durataMin(pausa) : 'Nessuna sosta'}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {INCREMENTI.map(({ min, etichetta }) => (
              <button
                key={min}
                onClick={() => aggiungi(min)}
                className="py-2 max-lg:py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs rounded transition-colors
                           focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={`Aggiungi ${etichetta} di sosta`}
              >
                +{etichetta}
              </button>
            ))}
          </div>
          {pausa > 0 && (
            <button
              onClick={azzera}
              className="mt-1.5 w-full py-1.5 max-lg:py-2 text-[11px] text-gray-400 hover:text-red-300 rounded transition-colors"
            >
              Azzera la sosta
            </button>
          )}
        </div>
      )}
    </>
  );
}
