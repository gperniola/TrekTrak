'use client';

import { useEffect, useRef } from 'react';
import { loadSettings, KEYS } from '@/lib/storage';
import { profiloIniziale, profiloPerInvito } from '@/lib/startup-profilo';
import { mostra } from '@/lib/profilo';
import { loadCurrent } from '@/lib/current-itinerary';
import { startupAction } from '@/lib/startup-itinerary';
import { decodeItinerary } from '@/lib/share-url';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { confirm as appConfirm, toast } from '@/stores/notificationStore';

/**
 * Gli effetti di avvio della pagina, ognuno col suo nome.
 *
 * Stavano tutti dentro `Home`, in mezzo alla disposizione dell'interfaccia: sette effetti
 * indipendenti che si leggevano come una cosa sola. Sono indipendenti davvero — l'unico
 * ordine che conta è quello dichiarato in `useRipristinoItinerario`.
 *
 * Il livello utente e il profilo si leggono qui dallo storage; le **decisioni** stanno in
 * funzioni pure (`profiloIniziale`, `startupAction`), che si verificano senza DOM.
 */

/** Legge una chiave senza far cadere l'avvio se lo storage è bloccato. */
function daStorage(chiave: string): string | null {
  try { return localStorage.getItem(chiave); } catch { return null; }
}

/** Sessione, invito e appartenenza: una volta, al montaggio. */
export function useAvvioAuth() {
  useEffect(() => { void useAuthStore.getState().init(); }, []);
}

/** Le impostazioni salvate tornano nello store. */
export function useImpostazioniSalvate() {
  useEffect(() => {
    useItineraryStore.getState().updateSettings(loadSettings());
  }, []);
}

/**
 * Il profilo d'uso all'avvio, e le due cose che possono cambiarlo dopo.
 *
 * - **L'invito ha la precedenza sul profilo salvato**: la libreria condivisa è area di
 *   Montagna, e chi apre un link di invito non deve trovare l'app che gli nasconde proprio
 *   la cosa per cui è stato invitato.
 * - **In Montagna i valori li calcola l'app**, quindi il modo si allinea al profilo. I
 *   valori inseriti a mano non si perdono — `learnValues` e `trackValues` vivono in
 *   parallelo dalla v0.7.0 — quindi tornando in Imparo si rivedono: il profilo cambia la
 *   vista, non i dati.
 */
export function useProfiloDiAvvio(inFlussoInvito: boolean) {
  useEffect(() => {
    useUIStore.getState().setProfilo(profiloIniziale({
      salvato: daStorage(KEYS.profilo),
      livello: daStorage(KEYS.userLevel),
    }));
  }, []);

  useEffect(() => {
    if (!inFlussoInvito) return;
    const voluto = profiloPerInvito(useUIStore.getState().profilo, true);
    if (voluto !== useUIStore.getState().profilo) useUIStore.getState().setProfilo(voluto);
  }, [inFlussoInvito]);

  const profilo = useUIStore((s) => s.profilo);
  const modo = useItineraryStore((s) => s.appMode);
  useEffect(() => {
    if (profilo === 'montagna' && modo !== 'track') {
      useItineraryStore.getState().setAppMode('track');
    }
  }, [profilo, modo]);
}

/**
 * Rimette in piedi l'itinerario su cui si stava lavorando.
 *
 * Deve stare **prima** dell'import da link: se arriva un itinerario condiviso, quello ha
 * l'ultima parola.
 */
export function useRipristinoItinerario() {
  useEffect(() => {
    const azione = startupAction(loadCurrent(), daStorage(KEYS.userLevel));
    if (azione.kind === 'restore') {
      useItineraryStore.getState().hydrateCurrent(azione.saved);
      /*
        Il salvataggio di ripiego (spazio esaurito) butta geometrie e profili: senza dirlo,
        l'itinerario ricompare con linee rette al posto dei sentieri e sembra che i dati si
        siano corrotti. `slim` esisteva ed era letto da nessuno — lo stesso difetto del
        livello utente, corretto poche ore prima.
      */
      if (azione.saved.slim) {
        toast.info(
          'Itinerario ripristinato. Il tracciato dettagliato sui sentieri non era stato '
          + 'salvato per mancanza di spazio: i tuoi valori ci sono tutti.',
          8000,
        );
      }
    } else if (azione.kind === 'appMode') {
      useItineraryStore.getState().setAppMode(azione.mode);
    }
  }, []);
}

/**
 * L'itinerario arrivato in un link condiviso (`#data=`).
 *
 * Da quando il lavoro in corso sopravvive alla chiusura, aprire un link condiviso può
 * cancellare giorni di lavoro: si **chiede**, come già fa l'import da file JSON.
 *
 * L'hash si ripulisce preservando `history.state`: passare `null` azzererebbe lo stato del
 * router di Next e farebbe ricaricare la pagina al primo `popstate`.
 */
export function useItinerarioDaLink() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#data=')) return;
    const decodificato = decodeItinerary(hash);
    const pulisciHash = () => history.replaceState(window.history.state, '', window.location.pathname);
    if (!decodificato) { pulisciHash(); return; }

    void (async () => {
      const store = useItineraryStore.getState();
      if (store.waypoints.length > 0) {
        const ok = await appConfirm({
          title: 'Aprire l’itinerario condiviso?',
          message: 'L’itinerario su cui stai lavorando verrà sostituito.',
          confirmText: 'Apri condiviso',
        });
        if (!ok) { pulisciHash(); return; }
      }
      const id = Math.random().toString(36).substring(2, 11);
      store.loadItinerary(id, decodificato.name, decodificato.waypoints, decodificato.legs);
      pulisciHash();
    })();
  }, []);
}

/**
 * **Primo accesso da telefono: si apre la Libreria, non la mappa.**
 *
 * Appena l'utente è autenticato ma non ha ancora uno username (sessione presente, nessuna
 * riga member), la prima cosa che deve vedere è la scelta dello username. Scatta una sola
 * volta, e solo sotto il breakpoint `lg`: su desktop il pannello è già fisso a schermo.
 */
export function useOnboardingMobile() {
  const inCorso = useAuthStore((s) => s.loading);
  const sessione = useAuthStore((s) => s.session);
  const membro = useAuthStore((s) => s.member != null);
  const fatto = useRef(false);

  useEffect(() => {
    if (fatto.current || inCorso) return;
    if (sessione && !membro) {
      fatto.current = true;
      /*
        Con la libreria spenta (vedi `LIBRERIA_DISPONIBILE`) la scheda non esiste:
        aprirla lascerebbe un foglio Editor con `mobileTab` fuori posto.
      */
      if (!mostra('libreria', useUIStore.getState().profilo)) return;
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        useUIStore.getState().setMobileTab('library');
      }
    }
  }, [inCorso, sessione, membro]);
}
