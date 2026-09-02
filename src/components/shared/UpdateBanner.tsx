'use client';

import { useEffect, useState } from 'react';

/**
 * Avvisa quando il service worker rileva una nuova versione dell'app e offre un
 * pulsante per ricaricare e applicarla subito. Senza questo, una PWA continua a
 * servire la versione in cache finché l'utente non chiude e riapre del tutto.
 *
 * Mostra il banner solo quando esiste già un controller (= aggiornamento, non
 * la primissima installazione del service worker).
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    const watch = (sw: ServiceWorker | null) => {
      if (!sw) return;
      const check = () => {
        if (!cancelled && sw.state === 'installed' && navigator.serviceWorker.controller) {
          setShow(true);
        }
      };
      check();
      sw.addEventListener('statechange', check);
    };

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg || cancelled) return;
        if (reg.waiting && navigator.serviceWorker.controller) setShow(true);
        watch(reg.installing);
        reg.addEventListener('updatefound', () => watch(reg.installing));
      })
      .catch(() => {
        /* registrazione SW non disponibile: nessun avviso */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[1400] flex items-center justify-between gap-2 px-3 py-2 bg-green-600 text-black text-sm shadow-lg"
    >
      <span className="font-medium">È disponibile una nuova versione di TrekTrak.</span>
      <button
        onClick={() => window.location.reload()}
        /*
          Il chip **schiarisce** invece di scurire, e con un bianco **letterale**.

          Con `bg-black/20` il verde sotto il testo nero si spegneva e il contrasto
          scendeva a 4,28:1, appena sotto la soglia: il pulsante era la parte meno
          leggibile di un avviso che esiste per farsi leggere.

          Ma non basta scrivere `bg-white/25`: `white` in questo progetto e' il token
          `--bianco`, che nel tema chiaro diventa **quasi nero** (15 23 42) perche' la',
          sul fondo della pagina, e' il colore del testo acceso. Questo banner invece ha
          un fondo `bg-green-600` **letterale**, che non si rovescia col tema: mescolare
          un fondo fisso con un colore che si rovescia dava 8,6:1 nello scuro e 4,20:1
          nel chiaro. Un letterale sopra un letterale sta a 8,6:1 nei due temi.
          (Stessa radice del TASK-63, dove il fondo fisso e' il bianco dei popup.)
        */
        className="shrink-0 bg-[#ffffff40] hover:bg-[#ffffff66] rounded px-3 min-h-[36px] font-bold"
      >
        Ricarica
      </button>
    </div>
  );
}
