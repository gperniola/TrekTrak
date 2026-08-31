'use client';

import { useEffect, useState } from 'react';

/** La stessa soglia di Tailwind `lg`, dove l'app passa da sheet a pannelli. */
const SOGLIA = '(max-width: 1023px)';

/**
 * Vero sui formati dove i pannelli sono fogli che salgono dal basso.
 *
 * Serve per armare il trascinamento verso il basso solo dove ha senso: su schermo
 * grande gli stessi pannelli sono riquadri flottanti o modali centrati, e un
 * trascinamento col mouse li chiuderebbe mentre provi a selezionare del testo.
 *
 * Parte da `false` e si corregge nel primo effetto, come `useOnline`: leggere
 * `matchMedia` durante il render romperebbe l'idratazione, perche' sul server non
 * esiste. Partire da `false` significa che il gesto si arma un istante dopo il primo
 * render, e non e' un problema: nessuno trascina nel primo fotogramma.
 */
export function useSchermoPiccolo(): boolean {
  const [piccolo, setPiccolo] = useState(false);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(SOGLIA);
    } catch {
      return;
    }
    setPiccolo(mq.matches);
    const cambia = (e: MediaQueryListEvent) => setPiccolo(e.matches);
    mq.addEventListener('change', cambia);
    return () => mq.removeEventListener('change', cambia);
  }, []);

  return piccolo;
}
