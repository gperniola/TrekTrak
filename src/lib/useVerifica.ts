'use client';

import { useEffect, useRef, useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { toast } from '@/stores/notificationStore';
import { loadValidationHistory, saveValidationSession } from '@/lib/storage';
import { miglioramento, raccogliEsiti, verificaItinerario } from '@/lib/verifica-itinerario';

/** Il riassunto che compare nel banner appena la verifica finisce. */
export interface RiassuntoVerifica {
  valid: number;
  warning: number;
  error: number;
  /** Punti percentuali guadagnati o persi rispetto alla sessione precedente. */
  improvement?: number;
}

export interface Verifica {
  verificando: boolean;
  banner: RiassuntoVerifica | null;
  /** Il banner sta sfumando: serve solo alla transizione di opacità. */
  inDissolvenza: boolean;
  verifica: () => Promise<void>;
  chiudiBanner: () => void;
}

/** Quanto resta il banner prima di iniziare a sfumare, e quanto dura la sfumatura. */
const DURATA_BANNER_MS = 3700;
const DISSOLVENZA_MS = 300;

/**
 * **Il gesto «Verifica»: lanciarla, salvarla nel diario, mostrarne l'esito.**
 *
 * La verifica in sé sta in `lib/verifica-itinerario.ts`; qui c'è tutto quello che serve
 * per farla partire da un pulsante e sopravvivere a quello che l'utente fa mentre gira.
 *
 * ## Le tre guardie, e cos'ha rotto ognuna
 *
 * - **`inCorsoRef`** — il pulsante è disabilitato durante la verifica, ma un doppio tocco
 *   rapido arriva prima che React ridisegni: due verifiche in parallelo sugli stessi dati.
 *   Il riferimento è sincrono, lo stato no.
 * - **`montatoRef`** — la verifica dura secondi; se nel frattempo il pannello si chiude,
 *   scrivere lo stato di un componente smontato è un errore in console e un timer che non
 *   muore.
 * - **`generazioneRef`** — se parte una verifica nuova, i risultati della precedente non
 *   devono più scriversi sopra i suoi. Il contatore va incrementato sul riferimento
 *   **vivo**: copiarlo in una variabile dentro l'effetto di pulizia, come suggerirebbe la
 *   regola di ESLint, annullerebbe l'invalidazione, che è tutto il senso del contatore.
 */
export function useVerifica(): Verifica {
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const updateLeg = useItineraryStore((s) => s.updateLeg);

  const [verificando, setVerificando] = useState(false);
  const [banner, setBanner] = useState<RiassuntoVerifica | null>(null);
  const [inDissolvenza, setInDissolvenza] = useState(false);

  const inCorsoRef = useRef(false);
  const montatoRef = useRef(true);
  const generazioneRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    montatoRef.current = true;
    return () => {
      montatoRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generazioneRef.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const chiudiBanner = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner(null);
    setInDissolvenza(false);
  };

  const verifica = async () => {
    if (inCorsoRef.current) return;
    inCorsoRef.current = true;
    setVerificando(true);
    const generazione = ++generazioneRef.current;
    const annullata = () => !montatoRef.current || generazioneRef.current !== generazione;
    try {
      const { servizioQuote } = await verificaItinerario({ annullata, updateLeg, updateWaypoint });

      if (!servizioQuote && montatoRef.current) {
        toast.warning(
          'Servizio altimetrico non disponibile: distanza e azimuth validati, altitudine e D+/D- saltati.',
          6000,
        );
      }

      if (montatoRef.current && !annullata()) {
        const stato = useItineraryStore.getState();
        const { esiti, validi, avvisi, errori } = raccogliEsiti(stato.waypoints, stato.legs);
        if (esiti.length > 0) {
          const scarto = miglioramento(validi, esiti.length, loadValidationHistory());
          saveValidationSession({
            date: new Date().toISOString(),
            itineraryName: stato.itineraryName,
            results: esiti,
          });
          if (timerRef.current) clearTimeout(timerRef.current);
          setInDissolvenza(false);
          setBanner({ valid: validi, warning: avvisi, error: errori, improvement: scarto });
          timerRef.current = setTimeout(() => {
            if (!montatoRef.current) return;
            setInDissolvenza(true);
            timerRef.current = setTimeout(() => {
              if (montatoRef.current) { setBanner(null); setInDissolvenza(false); }
            }, DISSOLVENZA_MS);
          }, DURATA_BANNER_MS);
        }
      }
    } finally {
      inCorsoRef.current = false;
      if (montatoRef.current) setVerificando(false);
    }
  };

  return { verificando, banner, inDissolvenza, verifica, chiudiBanner };
}
