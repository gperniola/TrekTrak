'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export function useTessereOffline(): TessereOffline {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const settings = useItineraryStore((s) => s.settings);
  const [avanzamento, setAvanzamento] = useState<Avanzamento | null>(null);
  const controllo = useRef<AbortController | null>(null);

  useEffect(() => () => controllo.current?.abort(), []);

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

    const ac = new AbortController();
    controllo.current = ac;
    setAvanzamento({ fatte: 0, totali: daScaricare.length, fallite: 0 });
    const esito = await scaricaTessere(daScaricare, { onAvanzamento: setAvanzamento, signal: ac.signal });
    setAvanzamento(null);
    controllo.current = null;

    /*
      Anche chiudere il pannello interrompe. Non e' grave e conviene dirlo: le mattonelle
      gia' prese le serve il service worker dalla cache, quindi riavviare lo scaricamento
      non le richiede alla rete una seconda volta.
    */
    if (esito.interrotto) {
      toast.info('Scaricamento interrotto: quello che è arrivato resta, e riavviandolo non si riscarica.');
    } else if (esito.fallite > 0) {
      toast.warning(`Scaricate ${numero(esito.fatte)} mattonelle, ${numero(esito.fallite)} non sono arrivate.`);
    } else {
      toast.success(`Mappa disponibile senza rete fino allo zoom ${piano.zoomRaggiunto}.`);
    }
  }, [piano, mappa, daScaricare]);

  return {
    piano,
    area,
    daScaricare,
    nomeMappa: mappa?.label ?? 'mappa',
    conSentieri,
    avanzamento,
    inCorso: avanzamento != null,
    scarica,
    interrompi: () => controllo.current?.abort(),
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
