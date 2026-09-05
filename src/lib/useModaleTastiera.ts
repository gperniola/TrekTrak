'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * **Un modale, da tastiera: Esc chiude, il fuoco entra e non esce.**
 *
 * Era in doppia copia — `WhatsNew` e `RouteWeatherPanel` — con nomi diversi per le stesse
 * variabili, che è il motivo per cui la ricerca dei blocchi identici non l'aveva vista.
 *
 * ## Le tre cose, e perché sono tre
 *
 * - **`Escape` chiude.** Un modale che si chiude solo con un bersaglio da colpire esclude
 *   chi non usa il mouse.
 * - **Il fuoco entra.** Senza, chi arriva col Tab deve attraversare tutta la pagina dietro
 *   per raggiungere il pannello che gli è appena comparso davanti.
 * - **Il fuoco non esce** (la trappola). Senza, con Tab si finisce sui comandi dietro al
 *   modale — che nel frattempo sono coperti, quindi si sta usando qualcosa che non si
 *   vede. Il ramo `shiftKey` è la metà che una terza copia scritta in fretta dimentica:
 *   si accorge del giro in avanti e non di quello indietro.
 *
 * La funzione di chiusura sta in un riferimento e non fra le dipendenze: gli ascoltatori
 * si agganciano una volta per apertura, come in [[useChiudiFuori]].
 */
export function useModaleTastiera<T extends HTMLElement>(
  aperto: boolean,
  chiudi: () => void,
): MutableRefObject<T | null> {
  /*
    `MutableRefObject` e non `RefObject`: `RouteWeatherPanel` deve poter scrivere in
    `current` da se', perche' lo stesso nodo serve a due hook — questo e il
    trascinamento del foglio — e li unisce in una callback che assegna a mano.
  */
  const dialogo = useRef<T | null>(null);
  const chiudiOra = useRef(chiudi);
  chiudiOra.current = chiudi;

  useEffect(() => {
    if (!aperto) return;

    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudiOra.current(); };
    window.addEventListener('keydown', esc);

    dialogo.current?.focus();

    const elemento = dialogo.current;
    const trappola = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || elemento == null) return;
      const fuocabili = elemento.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const primo = fuocabili[0];
      const ultimo = fuocabili[fuocabili.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === primo) { e.preventDefault(); ultimo?.focus(); }
      } else if (document.activeElement === ultimo) {
        e.preventDefault(); primo?.focus();
      }
    };
    elemento?.addEventListener('keydown', trappola);

    return () => {
      window.removeEventListener('keydown', esc);
      elemento?.removeEventListener('keydown', trappola);
    };
  }, [aperto]);

  return dialogo;
}
