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
        className="shrink-0 bg-black/20 hover:bg-black/30 rounded px-3 min-h-[36px] font-bold"
      >
        Ricarica
      </button>
    </div>
  );
}
