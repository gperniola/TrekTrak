'use client';

import { useEffect, useState } from 'react';

/**
 * Avvisa quando il service worker rileva una nuova versione dell'app e offre un pulsante
 * per ricaricare e applicarla. Senza, una PWA continua a servire la versione in cache
 * finché non la si chiude e riapre del tutto — la segnalazione dell'utente «l'app non si
 * aggiorna all'ultima versione».
 *
 * ## Perché guardare `controllerchange`, non solo `installing`/`waiting`
 *
 * Il service worker è configurato con `skipWaiting` + `clientsClaim` (`app/sw.ts`): un SW
 * nuovo si attiva **subito**, senza sostare in «waiting», e prende il controllo della
 * pagina. La versione precedente di questo banner guardava solo lo stato `installing`/
 * `waiting`: se il SW nuovo si era già attivato prima che il banner montasse — cioè quasi
 * sempre, perché aggiorna in background — non c'era più niente da vedere, e l'avviso non
 * compariva mai. Il segnale affidabile è `controllerchange`: il controller della pagina è
 * cambiato = una versione nuova ha preso il posto di quella con cui la pagina era partita.
 *
 * ## Perché chiamare `registration.update()`
 *
 * Il browser cerca un SW nuovo alla navigazione. Una PWA installata resta aperta senza
 * navigare per ore, quindi da sola non se ne accorgerebbe: si chiede noi il controllo,
 * all'avvio e ogni volta che l'app torna in primo piano (il momento in cui la si riapre
 * prima di una gita).
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    const mostra = () => { if (!cancelled) setShow(true); };

    /*
     * Il controller al montaggio: se c'è già, un `controllerchange` successivo è un
     * AGGIORNAMENTO (una versione nuova ha preso il posto). Se non c'è — primissima
     * installazione — il primo `controllerchange` è solo il SW che si insedia, non un
     * aggiornamento, e non si avvisa.
     */
    const controllerIniziale = navigator.serviceWorker.controller;
    const alCambioController = () => { if (controllerIniziale) mostra(); };
    navigator.serviceWorker.addEventListener('controllerchange', alCambioController);

    let reg: ServiceWorkerRegistration | null = null;

    const controlla = () => { reg?.update().catch(() => { /* offline o non disponibile */ }); };
    const allaVisibilita = () => { if (document.visibilityState === 'visible') controlla(); };
    document.addEventListener('visibilitychange', allaVisibilita);
    // Rete di sicurezza per chi tiene l'app aperta a lungo senza mai nasconderla.
    const timer = setInterval(controlla, 60 * 60 * 1000);

    const seguiInstallazione = (sw: ServiceWorker | null) => {
      if (!sw) return;
      const check = () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) mostra();
      };
      check();
      sw.addEventListener('statechange', check);
    };

    navigator.serviceWorker
      .getRegistration()
      .then((r) => {
        if (!r || cancelled) return;
        reg = r;
        // Un SW nuovo già in attesa (skipWaiting a parte, può capitare) è un aggiornamento.
        if (r.waiting && navigator.serviceWorker.controller) mostra();
        seguiInstallazione(r.installing);
        r.addEventListener('updatefound', () => seguiInstallazione(r.installing));
        controlla(); // una prima verifica all'avvio
      })
      .catch(() => { /* registrazione non disponibile: nessun avviso */ });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', alCambioController);
      document.removeEventListener('visibilitychange', allaVisibilita);
      clearInterval(timer);
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
        className="shrink-0 bg-[#ffffff40] hover:bg-[#ffffff66] rounded px-3 min-h-[36px] max-lg:min-h-[44px] font-bold"
      >
        Ricarica
      </button>
    </div>
  );
}
