'use client';

import { useEffect, useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { applicaTema, temaEffettivo, temaValido, type Tema } from './tema';

/**
 * Tiene l'aspetto dell'app allineato alla scelta e al sistema (task-35).
 *
 * Sta in un hook e non nel pannello delle impostazioni perche' il tema va applicato
 * **sempre**, non solo quando quel pannello e' aperto: lo usa la pagina all'avvio, e lo
 * riusa il selettore per poter dire quale aspetto il sistema sta chiedendo adesso.
 */
export function useTema(): { tema: Tema; sistemaScuro: boolean; effettivo: 'chiaro' | 'scuro' } {
  const tema = temaValido(useItineraryStore((s) => s.settings.tema));
  const [sistemaScuro, setSistemaScuro] = useState(false);

  /*
   * `prefers-color-scheme` si legge in un effetto e non durante il render: al primo
   * disegno sul server non esiste, e leggerla la' darebbe una pagina diversa da quella
   * che il browser ricostruisce. Si parte da «scuro» — il tema con cui l'app e' nata — e
   * si corregge subito dopo.
   *
   * E si **ascolta**, non si legge una volta: chi mette il telefono in scuro alle sette
   * di sera si aspetta che l'app lo segua senza riaprirla.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setSistemaScuro(query.matches);
    const cambio = (e: MediaQueryListEvent) => setSistemaScuro(e.matches);
    query.addEventListener('change', cambio);
    return () => query.removeEventListener('change', cambio);
  }, []);

  const effettivo = temaEffettivo(tema, sistemaScuro);

  useEffect(() => {
    applicaTema(effettivo);
  }, [effettivo]);

  return { tema, sistemaScuro, effettivo };
}
