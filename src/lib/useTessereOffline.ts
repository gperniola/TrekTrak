'use client';

import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { useItineraryStore } from '@/stores/itineraryStore';
import { BASE_MAPS, HIKING_TRAILS_OVERLAY } from '@/lib/types';
import { toast } from '@/stores/notificationStore';
import {
  areaKm2,
  pianifica,
  rettangoloConMargine,
  rettangoloDaPunti,
  tessereLungoIlPercorso,
  urlDaScaricare,
  type Piano,
} from '@/lib/tile-offline';
import {
  scaricaTessere,
  svuotaTessere,
  type Avanzamento,
} from '@/lib/tile-download';
import { numero } from '@/lib/formato';

/**
 * Il pre-caricamento delle mattonelle, **in un posto solo**.
 *
 * Serve a due chiamanti: la sezione in Impostazioni mappa e il pulsante nell'editor. Il
 * conto e il lavoro sono già stati due copie una volta, in questa stessa funzione — il
 * pannello prometteva 35 mattonelle e ne scaricava 70 — e la lezione era che due posti
 * che calcolano la stessa cosa finiscono per calcolarla in modo diverso. Qui c'è una
 * sola verità, e chi la mostra la legge da qui.
 *
 * **Non scarica mai da sé.** Nessun effetto, nessun timer, nessuna soglia: parte solo
 * quando qualcuno chiama `scarica()`, cioè quando l'utente lo chiede. Le mattonelle si
 * prendono da servizi che ce le regalano, e un'app che le scarica di sua iniziativa
 * spende la banda e la cortesia di qualcun altro senza averlo chiesto a nessuno.
 */
export interface TessereOffline {
  /** Il piano per l'itinerario corrente, o `null` se non c'è area da cui ricavarlo. */
  piano: Piano | null;
  /** L'area in km² del rettangolo con margine. */
  area: number;
  /** L'elenco esatto delle URL che verranno chieste: è anche il numero da mostrare. */
  daScaricare: string[];
  /** Il nome della mappa base corrente, per dirlo a chi guarda. */
  nomeMappa: string;
  /** `true` se i sentieri sono accesi e quindi fanno parte dello scaricamento. */
  conSentieri: boolean;
  avanzamento: Avanzamento | null;
  inCorso: boolean;
  scarica: () => Promise<void>;
  interrompi: () => void;
}

/**
 * Lo stato dello scaricamento sta **fuori dai componenti**, ed è uno solo.
 *
 * Il calcolo era già condiviso — è la correzione che ha evitato che il numero mostrato
 * divergesse da quello scaricato — ma lo stato era per istanza, un `useState` per
 * componente. Con l'editor e le impostazioni mappa montati insieme (aprire il dialogo non
 * smonta l'editor) si otteneva:
 *
 * - il pannello mostrava «Scarica per l'uso senza rete» mentre l'editor stava scaricando;
 * - premendolo partiva un **secondo** scaricamento in parallelo, cioè il doppio del
 *   traffico su servizi gratuiti — la cosa che tutto questo codice dichiara di evitare;
 * - «libera» restava attivo, quindi si poteva svuotare la cache a metà di uno
 *   scaricamento.
 *
 * È la stessa lezione, applicata allo stato invece che al calcolo: due copie della stessa
 * verità divergono.
 */
interface StatoScaricamento {
  avanzamento: Avanzamento | null;
  controllo: AbortController | null;
  set: (a: Avanzamento | null) => void;
  prendiIlControllo: (c: AbortController | null) => void;
}

const useStatoScaricamento = create<StatoScaricamento>((set) => ({
  avanzamento: null,
  controllo: null,
  set: (avanzamento) => set({ avanzamento }),
  prendiIlControllo: (controllo) => set({ controllo }),
}));

export function useTessereOffline(): TessereOffline {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const settings = useItineraryStore((s) => s.settings);
  const avanzamento = useStatoScaricamento((s) => s.avanzamento);
  const setAvanzamento = useStatoScaricamento((s) => s.set);

  /*
    **Non si annulla allo smontaggio.** Prima si faceva, e con lo stato condiviso sarebbe
    diventato un guasto: chiudere il dialogo delle impostazioni fermerebbe lo scaricamento
    avviato dall'editor, che resta montato. Lo si annulla solo quando qualcuno tocca
    «interrompi» — che e' l'unico gesto che lo chiede davvero.
  */

  const mappa = BASE_MAPS.find((m) => m.id === settings.mapDisplay.baseMap);
  // Se i sentieri escursionistici sono accesi fanno parte di cio' che si vede: senza,
  // offline la mappa ci sarebbe e i sentieri no.
  const conSentieri = settings.mapDisplay.showHikingTrails;

  /*
    Memorizzato, e non per eleganza: `urlDaScaricare` costruisce **fino a mille stringhe**,
    e senza memo lo rifarebbe a ogni render — di due componenti — restituendo ogni volta
    un array nuovo, che a sua volta invaliderebbe il `useCallback` qui sotto rendendolo
    inutile.
  */
  const { piano, area, daScaricare } = useMemo(() => {
    const rettangolo = rettangoloDaPunti(waypoints);
    if (rettangolo == null || mappa == null) return { piano: null, area: 0, daScaricare: [] };

    /*
      **La geometria vera del sentiero, quando c'e'.** Le tratte calcolate su sentiero
      portano il tracciato reale: seguirlo copre quello che si cammina, invece della corda
      fra due waypoint. Su un percorso con tornanti la differenza e' tutta la valle
      accanto.
    */
    const geometria = legs.flatMap((l) => l.routeGeometry ?? l.trackValues?.routeGeometry ?? []);

    /*
      **Il corridoio, non il rettangolo** (segnalato il 2026-09-02: «il numero di tile
      sembra eccessivo»). Coprire il rettangolo che contiene il percorso vuol dire
      scaricare anche cio' che il percorso non attraversa. Misurato sugli zoom 12-16: una
      diagonale di 8 km passa da 611 mattonelle a 219, una traversata di 25 km da 5.372 a
      558 — e su quest'ultima col rettangolo il tetto si esauriva allo zoom 13, cioe' si
      tornava con una mappa sfocata.
    */
    const p = pianifica((z) => tessereLungoIlPercorso(waypoints, z, {
      geometria: geometria.length > 1 ? geometria : undefined,
    }));

    return {
      piano: p,
      // L'area resta quella del rettangolo con margine: e' cio' che serve a dire «questo
      // non e' piu' un'escursione», e per quel giudizio conta l'estensione, non il
      // corridoio.
      area: areaKm2(rettangoloConMargine(rettangolo)),
      daScaricare: urlDaScaricare(p.tessere, mappa.url, conSentieri ? HIKING_TRAILS_OVERLAY.url : null),
    };
  }, [waypoints, legs, mappa, conSentieri]);

  const scarica = useCallback(async () => {
    if (piano == null || mappa == null || daScaricare.length === 0) return;
    /*
      **Uno per volta.** Con lo stato condiviso, due pannelli montati insieme potevano
      avviarne due in parallelo: il doppio del traffico su servizi gratuiti, per le stesse
      mattonelle.
    */
    if (useStatoScaricamento.getState().avanzamento != null) return;

    const ac = new AbortController();
    useStatoScaricamento.getState().prendiIlControllo(ac);
    setAvanzamento({ fatte: 0, totali: daScaricare.length, fallite: 0 });
    const esito = await scaricaTessere(daScaricare, { onAvanzamento: setAvanzamento, signal: ac.signal });
    setAvanzamento(null);
    useStatoScaricamento.getState().prendiIlControllo(null);

    /*
      Si interrompe **solo** toccando «interrompi»: chiudere il pannello non ferma piu'
      niente, da quando lo stato e' condiviso. E riavviarlo costa poco, perche' le
      mattonelle gia' prese le serve il service worker dalla cache senza toccare la rete —
      conviene dirlo, o si crede di aver buttato il lavoro fatto.
    */
    if (esito.interrotto) {
      toast.info('Scaricamento interrotto: quello che è arrivato resta, e riavviandolo non si riscarica.');
    } else if (esito.fallite > 0) {
      toast.warning(`Scaricate ${numero(esito.fatte)} mattonelle, ${numero(esito.fallite)} non sono arrivate.`);
    } else {
      toast.success(`Mappa disponibile senza rete fino allo zoom ${piano.zoomRaggiunto}.`);
    }
  }, [piano, mappa, daScaricare, setAvanzamento]);

  return {
    piano,
    area,
    daScaricare,
    nomeMappa: mappa?.label ?? 'mappa',
    conSentieri,
    avanzamento,
    inCorso: avanzamento != null,
    scarica,
    interrompi: () => useStatoScaricamento.getState().controllo?.abort(),
  };
}

/**
 * Libera le mattonelle conservate quando si **abbandona** l'itinerario.
 *
 * Le mattonelle sono state scaricate per un percorso: buttato quello, occupano spazio per
 * niente — e su un telefono lo spazio che il browser concede è dell'ordine dei dieci
 * gigabyte, con ogni mattonella contata circa cinque megabyte.
 *
 * **Si dice, non si fa in silenzio.** Chi ha scaricato la mappa di una gita e poi tocca
 * «Nuovo» deve sapere che quella mappa non c'è più, altrimenti lo scopre in quota — che è
 * il momento peggiore possibile.
 *
 * Non si tocca invece l'eliminazione di un percorso **dalla libreria**: la cache è unica
 * per servizio di mappe, non per itinerario, quindi da lì non si può sapere se quelle
 * mattonelle appartengono al percorso cancellato o a quello aperto sul tavolo.
 */
export async function liberaTessereDelPercorso(): Promise<void> {
  const quante = await svuotaTessere();
  if (quante > 0) toast.info('Liberate anche le mappe scaricate per quel percorso.');
}
