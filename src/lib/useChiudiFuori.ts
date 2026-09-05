'use client';

import { useEffect, useRef } from 'react';

/**
 * **Chiudi quando si tocca fuori, o con Esc.**
 *
 * Lo stesso blocco di dodici righe stava in cinque componenti — `UserHeader`,
 * `ElevationProfile`, `SummaryBar`, `ActionBar`, `IncollaCoordinate` — tutte e cinque
 * corrette. Quindi questo hook **non corregge un difetto**: impedisce il sesto. Cinque
 * copie sono cinque occasioni di scordarsi `touchstart`, che è quella che serve sul
 * telefono, cioè su dove l'app si usa.
 *
 * ## I tre eventi, e perché sono tre
 *
 * - `mousedown` e non `click`: il menu deve chiudersi appena si preme, non al rilascio,
 *   altrimenti un trascinamento iniziato fuori lo lascia aperto;
 * - `touchstart`: sul telefono `mousedown` arriva tardi o non arriva;
 * - `keydown` per `Escape`: chi naviga da tastiera deve poter uscire senza cercare il
 *   bersaglio da cliccare.
 *
 * ## Perché la chiusura sta in un riferimento
 *
 * Gli ascoltatori si agganciano **una volta per apertura**, non a ogni render: le
 * dipendenze dell'effetto sono solo `aperto`. Se la funzione di chiusura entrasse nelle
 * dipendenze, un chiamante che passa una lambda in linea — cioè tutti e cinque —
 * staccherebbe e riattaccherebbe tre ascoltatori a ogni render. Era il comportamento
 * degli originali, e questo hook lo conserva: un refactoring che cambia quando gli
 * ascoltatori si registrano non è un refactoring.
 */
export function useChiudiFuori<T extends HTMLElement>(
  aperto: boolean,
  chiudi: () => void,
): React.RefObject<T> {
  const contenitore = useRef<T>(null);
  const chiudiOra = useRef(chiudi);
  chiudiOra.current = chiudi;

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent | TouchEvent) => {
      if (contenitore.current && !contenitore.current.contains(e.target as Node)) {
        chiudiOra.current();
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chiudiOra.current();
    };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('touchstart', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('touchstart', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto]);

  return contenitore;
}
