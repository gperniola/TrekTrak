'use client';

import { useEffect, useRef, useState } from 'react';
import { GLOSSARIO, type Termine } from '@/lib/glossario';

/**
 * Titolo, definizione e parte pratica di un termine, senza il pulsante e senza il
 * riquadro: serve dove la definizione va mostrata DENTRO qualcos'altro (per esempio nel
 * popover del badge di validazione, dove un popover annidato si posizionerebbe male).
 * Il testo sta in un posto solo: qui e nel popover viene dallo stesso glossario.
 */
export function ContenutoGlossario({ termine }: { termine: Termine }) {
  const v = GLOSSARIO[termine];
  return (
    <>
      <span className="block font-bold text-green-400">{v.titolo}</span>
      <span className="block text-gray-200 not-italic">{v.definizione}</span>
      {v.comeSiUsa && <span className="block mt-1 text-gray-300 not-italic">{v.comeSiUsa}</span>}
    </>
  );
}

/**
 * Il pulsante ⓘ che apre la definizione di un termine.
 *
 * Prima ogni campo si portava dietro la propria frase (`info="Dislivello positivo
 * cumulativo (metri di salita)"`) e il proprio popover, con la sua gestione del clic
 * fuori e dell'Escape, tutto chiuso dentro `NumberInput`. Ora la definizione sta nel
 * glossario e il popover è uno solo, così può comparire anche accanto alla difficoltà o
 * dentro un suggerimento — e la stessa parola non finisce spiegata in due modi diversi.
 *
 * Si apre al clic e non al passaggio del mouse: su un telefono il passaggio del mouse
 * non esiste, ed era il difetto già corretto sui `title` nella v0.11.8.
 */
export function TermineGlossario({ termine, classe }: { termine: Termine; classe?: string }) {
  const [aperto, setAperto] = useState(false);
  const contenitore = useRef<HTMLSpanElement>(null);
  const v = GLOSSARIO[termine];

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) setAperto(false);
    };
    const tasto = (e: KeyboardEvent) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    document.addEventListener('keydown', tasto);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
      document.removeEventListener('keydown', tasto);
    };
  }, [aperto]);

  return (
    <span ref={contenitore} className={`relative inline-flex ${classe ?? ''}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAperto((p) => !p); }}
        className="text-gray-400 hover:text-gray-300 text-xs leading-none"
        aria-label={`Che cos'è: ${v.titolo}`}
        aria-expanded={aperto}
      >
        ⓘ
      </button>
      {aperto && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-5 z-[1300] w-[220px] bg-gray-800 border border-gray-600 rounded px-2.5 py-2 text-[11px] text-gray-200 shadow-lg leading-snug text-left block"
        >
          <ContenutoGlossario termine={termine} />
        </span>
      )}
    </span>
  );
}
