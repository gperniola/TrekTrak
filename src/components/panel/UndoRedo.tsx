'use client';

import { useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { azioneDaAnnullare, azioneDaRifare, puoAnnullare, puoRifare } from '@/stores/itinerary/storia';

/**
 * Annulla e rifai (task-19).
 *
 * **I pulsanti dicono cosa annullano**: «Annulla: rimozione del waypoint», non «Annulla».
 * Chi preme quel tasto di solito lo fa proprio perché non è più sicuro di cosa ha appena
 * combinato, e un comando che chiede di ricordarselo aiuta poco.
 *
 * Le scorciatoie sono quelle di sempre — Ctrl/Cmd+Z e Ctrl/Cmd+Maiusc+Z — ma **non
 * scattano mentre si scrive in un campo**: lì Ctrl+Z deve annullare le lettere battute,
 * che è quello che il browser fa da sé e che chi scrive si aspetta.
 */
export function UndoRedo() {
  const storia = useItineraryStore((s) => s.storia);
  const annulla = useItineraryStore((s) => s.annulla);
  const rifai = useItineraryStore((s) => s.rifai);

  const indietroPossibile = puoAnnullare(storia);
  const avantiPossibile = puoRifare(storia);
  const cosaAnnulla = azioneDaAnnullare(storia);
  const cosaRifa = azioneDaRifare(storia);

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const dove = e.target as HTMLElement | null;
      const scrive = dove != null
        && (dove.tagName === 'INPUT' || dove.tagName === 'TEXTAREA' || dove.isContentEditable);
      if (scrive) return;
      e.preventDefault();
      if (e.shiftKey) rifai();
      else annulla();
    };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, [annulla, rifai]);

  const stile = 'px-2 py-1 rounded-lg text-xs transition-all active:scale-[0.97] '
    + 'bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed '
    + 'max-lg:min-h-[44px] max-lg:min-w-[44px]';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={annulla}
        disabled={!indietroPossibile}
        className={stile}
        title={cosaAnnulla ? `Annulla: ${cosaAnnulla}` : 'Niente da annullare'}
        aria-label={cosaAnnulla ? `Annulla: ${cosaAnnulla}` : 'Niente da annullare'}
      >
        ↶
      </button>
      <button
        onClick={rifai}
        disabled={!avantiPossibile}
        className={stile}
        title={cosaRifa ? `Rifai: ${cosaRifa}` : 'Niente da rifare'}
        aria-label={cosaRifa ? `Rifai: ${cosaRifa}` : 'Niente da rifare'}
      >
        ↷
      </button>
    </div>
  );
}
