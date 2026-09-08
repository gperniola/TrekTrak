'use client';

import { useEffect, useState } from 'react';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { useOnline } from '@/lib/useOnline';
import type { DpcData } from '@/lib/emergency-api';
import type { DpcZone } from '@/lib/dpc';
import { giornoItaliano, type PuntoInterrogato } from '@/lib/route-weather';
import {
  checkRoute, routeAlertMessage, positionAlertSeverity, type PositionAlert,
} from '@/lib/dpc-position-alert';

/**
 * Bollettino scaricato di recente, tenuto in memoria per la sessione: riaprire il
 * pannello, o cambiare il passo, non deve riscaricare ~400 KB di geometrie. Trenta
 * minuti: il bollettino DPC si aggiorna una volta al giorno, quindi è abbondante.
 */
let cache: { at: number; data: DpcData } | null = null;
async function scaricaBollettino(): Promise<DpcData> {
  if (cache && Date.now() - cache.at < 30 * 60000) return cache.data;
  const { fetchDpcClient } = await import('@/lib/emergency-api');
  const data = await fetchDpcClient();
  cache = { at: Date.now(), data };
  return data;
}

function etichettaGiorno(giorno: string): string {
  const oggi = giornoItaliano(new Date());
  const domani = giornoItaliano(new Date(Date.now() + 86400000));
  if (giorno === oggi) return 'oggi';
  if (giorno === domani) return 'domani';
  return `il ${giorno.slice(8, 10)}/${giorno.slice(5, 7)}`;
}

/**
 * **In cima al meteo del percorso: se il giorno scelto ha un'allerta della Protezione
 * Civile su un tratto della traccia, lo dice subito.**
 *
 * Chiesto così: la previsione oraria dice «temporali alle 15», ma l'allerta ufficiale è
 * un'informazione diversa e più pesante, e va messa davanti — è la sicurezza, non il
 * meteo. Si controlla il giorno **di partenza**: il bollettino copre oggi e domani, e per
 * un giorno che non copre (dopodomani) tace, invece di dire il falso.
 *
 * Riusa `checkRoute`: basta che un punto del percorso cada in una zona in allerta. Se
 * nessun punto è in allerta ma una geometria è illeggibile, tace — «non lo so» non
 * diventa un falso «nessun avviso». Le coordinate non lasciano il dispositivo: le
 * geometrie si scaricano e il confronto avviene qui.
 */
export function AllertaDpcPercorso({ punti, departure }: { punti: PuntoInterrogato[]; departure: Date }) {
  const online = useOnline();
  const dpcInStore = useEmergencyStore((s) => s.dpc);
  const [alert, setAlert] = useState<PositionAlert | null>(null);
  const [giorno, setGiorno] = useState('');
  const [chiuso, setChiuso] = useState(false);

  const giornoPartenza = giornoItaliano(departure);

  useEffect(() => {
    // Nuovo giorno o nuovo percorso: si riparte da zero, e un avviso chiuso prima non
    // deve restare nascosto se ora l'allerta è un'altra.
    setAlert(null);
    setChiuso(false);
    if (punti.length === 0) return;
    // Offline i dati di emergenza sono esclusi dalla cache per scelta: niente da leggere.
    if (!online || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;

    const controller = new AbortController();
    void (async () => {
      let zones: DpcZone[] | null = null;
      // Se il layer DPC è già acceso, le zone sono nello store: nessun altro download.
      const inStore = dpcInStore?.days.find((d) => d.date === giornoPartenza);
      if (inStore) {
        zones = inStore.zones;
      } else {
        try {
          const dati = await scaricaBollettino();
          if (controller.signal.aborted) return;
          const d = dati.days.find((x) => x.date === giornoPartenza);
          if (!d) return; // il bollettino non copre quel giorno: nessun banner
          zones = d.zones;
        } catch {
          // Avviso di cortesia dentro un pannello meteo: un errore di rete qui non va
          // messo davanti all'utente. Il layer di emergenza lo dirà, se lo accende.
          return;
        }
      }
      if (zones == null || controller.signal.aborted) return;
      const esito = checkRoute(zones, punti.map((p) => ({ lat: p.lat, lon: p.lon })));
      if (esito.outcome !== 'alert') return;
      setAlert(esito.alert);
      setGiorno(etichettaGiorno(giornoPartenza));
    })();
    return () => controller.abort();
  }, [punti, giornoPartenza, online, dpcInStore]);

  if (alert == null || chiuso) return null;

  const grave = positionAlertSeverity(alert) === 'severe';
  return (
    <div
      role="alert"
      /*
        Colori pieni e FISSI, come il banner allerta-posizione: `text-su-colore` (bianco
        nei due temi) e `text-black` non seguono il tema, quindi non c'e' la mescolanza
        token-su-fondo-grezzo che in questo progetto ha rotto quattro avvisi in un giorno.
        Su fondo pieno un'allerta si vede, ed e' quello che deve fare.
      */
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        grave ? 'bg-red-700 text-su-colore' : 'bg-amber-700 text-black'
      }`}
    >
      <span aria-hidden className="leading-tight pt-0.5">⚠</span>
      <span className="flex-1 leading-snug">{routeAlertMessage(alert, giorno)}</span>
      <button
        onClick={() => setChiuso(true)}
        aria-label="Chiudi avviso allerta"
        className="shrink-0 opacity-70 hover:opacity-100 px-1 min-h-[44px] min-w-[44px] flex items-center justify-center -my-1"
      >
        ✕
      </button>
    </div>
  );
}
