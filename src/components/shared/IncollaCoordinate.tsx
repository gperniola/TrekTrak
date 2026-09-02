'use client';

import { useEffect, useRef, useState } from 'react';
import { coordinataItaliana, parseCoordinate, type Coordinate } from '@/lib/coordinate';

/**
 * Incolla una coppia di coordinate e posiziona il waypoint (task-26).
 *
 * Finora l'unico modo di mettere un punto con precisione era toccare la mappa col dito.
 * Chi arriva con una coordinata già in mano — da una relazione, da una guida, da un
 * messaggio di un compagno — non aveva nessuna porta: doveva cercare il punto a occhio.
 *
 * **Si vede dove finirà mentre si scrive.** È la differenza fra un campo che accetta e
 * uno che si capisce: incollando `42° 26' 30" N, 13° 33' 34" E` compare subito
 * «42,4419° N  13,5595° E», e se il testo non è una coordinata lo dice invece di
 * lasciarti premere un pulsante che non farà niente. Una coordinata indovinata male
 * sposta il waypoint in un altro posto **senza dirlo**, ed è il motivo per cui il parser
 * rifiuta invece di approssimare.
 */
export function IncollaCoordinate({
  onCoordinate,
  compatto,
}: {
  onCoordinate: (c: Coordinate) => void;
  /** Nel dettaglio della riga in Track lo spazio è poco: solo l'icona e il testo breve. */
  compatto?: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState('');
  const contenitore = useRef<HTMLDivElement>(null);

  const letta = testo.trim() === '' ? null : parseCoordinate(testo);

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) setAperto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto]);

  const conferma = () => {
    if (letta == null) return;
    onCoordinate(letta);
    setTesto('');
    setAperto(false);
  };

  return (
    <div ref={contenitore} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setAperto((p) => !p)}
        aria-expanded={aperto}
        className={compatto
          ? 'text-[11px] text-gray-400 hover:text-gray-200 min-h-[32px] px-1 shrink-0'
          : 'text-[10px] text-gray-400 hover:text-gray-200 min-h-[28px] px-1'}
        aria-label="Incolla coordinate"
      >
        📋 incolla
      </button>
      {aperto && (
        <div className="absolute left-0 top-full mt-1 z-[1300] w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 space-y-1.5">
          <input
            type="text"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); conferma(); }
            }}
            autoFocus
            placeholder="42,4419 13,5595"
            aria-label="Coordinate da incollare"
            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none"
          />
          <div role="status" className="text-[11px] leading-snug min-h-[16px]">
            {testo.trim() === '' ? (
              <span className="text-gray-400">
                Gradi decimali o gradi/primi/secondi, con la virgola o col punto.
              </span>
            ) : letta != null ? (
              <span className="text-green-400 tabular-nums">
                → {coordinataItaliana(letta.lat, letta.lon)}
              </span>
            ) : (
              <span className="text-amber-300">
                Non riconosciuto. Esempi: <span className="text-gray-300">42,4419 13,5595</span> oppure{' '}
                <span className="text-gray-300">42° 26&apos; 30&quot; N, 13° 33&apos; 34&quot; E</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={conferma}
            disabled={letta == null}
            className="w-full py-1 bg-green-600 text-black rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed min-h-[32px]"
          >
            Posiziona qui
          </button>
        </div>
      )}
    </div>
  );
}
