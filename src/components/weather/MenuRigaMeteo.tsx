'use client';

import { useEffect, useRef, useState } from 'react';
import { linkMeteoblue } from '@/lib/meteoblue';

/**
 * Le **azioni di una riga** del meteo del percorso, dietro tre puntini.
 *
 * Una voce sola per ora — aprire quel punto su Meteoblue — ma sta in un menu perché la
 * riga è già stretta di suo su un telefono, e perché le azioni di un punto cresceranno.
 *
 * Al tocco non esiste nessun `title` da leggere (lezione già pagata in questo progetto):
 * il pulsante porta scritto **di quale punto** è, non solo «altre azioni».
 */
export function MenuRigaMeteo({ lat, lon, nome }: { lat: number; lon: number; nome: string }) {
  const [aperto, setAperto] = useState(false);
  const contenitore = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aperto) return;
    const chiudiSeFuori = (e: Event) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperto(false);
    };
    const chiudiConEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAperto(false); };
    // `pointerdown` e non `click`: al tocco il menu deve sparire appena il dito appoggia,
    // altrimenti la prima toccata fuori serve solo a chiuderlo e la seconda a fare la cosa.
    document.addEventListener('pointerdown', chiudiSeFuori);
    document.addEventListener('keydown', chiudiConEsc);
    return () => {
      document.removeEventListener('pointerdown', chiudiSeFuori);
      document.removeEventListener('keydown', chiudiConEsc);
    };
  }, [aperto]);

  const indirizzo = linkMeteoblue(lat, lon);
  // Senza coordinate valide non c'è nessuna pagina da aprire: meglio nessun pulsante che
  // un pulsante che non porta da nessuna parte.
  if (indirizzo == null) return null;

  return (
    <div ref={contenitore} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aperto}
        aria-label={`Altre azioni per «${nome}»`}
        onClick={() => setAperto((x) => !x)}
        className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded max-lg:min-w-[44px] max-lg:min-h-[44px]"
      >
        <span aria-hidden>⋮</span>
      </button>

      {aperto && (
        <div
          role="menu"
          aria-label={`Azioni per «${nome}»`}
          className="absolute right-0 z-10 mt-1 min-w-[13rem] rounded-lg border border-gray-700 bg-gray-800 shadow-lg py-1"
        >
          <a
            role="menuitem"
            href={indirizzo}
            target="_blank"
            // `noopener`: senza, la pagina aperta puo' manipolare quella che l'ha aperta.
            rel="noopener noreferrer"
            onClick={() => setAperto(false)}
            className="block px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 max-lg:min-h-[44px]"
          >
            Apri su Meteoblue ↗
          </a>
        </div>
      )}
    </div>
  );
}
