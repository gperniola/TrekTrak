'use client';

import { useEffect, useState } from 'react';
import { usePositionStore } from '@/stores/positionStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { toYmd, type DpcZone } from '@/lib/dpc';
import { useOnline } from '@/lib/useOnline';
import {
  checkPosition, positionAlertMessage, positionAlertSeverity, type PositionAlert,
} from '@/lib/dpc-position-alert';

/**
 * Già annunciato in questa sessione, per QUESTO bollettino.
 *
 * La chiave include l'id del bollettino: senza, un bollettino emesso nel pomeriggio
 * non veniva mai annunciato in una sessione aperta al mattino, che è proprio il
 * momento in cui un'allerta nuova conta.
 */
function alreadyShown(bulletinId: string): boolean {
  try {
    return sessionStorage.getItem(`tt_dpc_pos_${bulletinId}`) === '1';
  } catch {
    return false;
  }
}

function markShown(bulletinId: string): void {
  try { sessionStorage.setItem(`tt_dpc_pos_${bulletinId}`, '1'); } catch { /* noop */ }
}

function zonesFromStore(oggi: string): { zones: DpcZone[]; bulletinId: string } | null {
  const dpc = useEmergencyStore.getState().dpc;
  const day = dpc?.days.find((d) => d.date === oggi);
  return dpc && day ? { zones: day.zones, bulletinId: dpc.bulletinId } : null;
}

/**
 * Avvisa se la posizione dell'utente cade in una zona con un'allerta della Protezione
 * Civile in corso. Se non ci sono allerte, o la posizione non è disponibile, tace.
 *
 * **Non chiede mai la posizione.** La legge da `positionStore`, dove la pubblica chi
 * la ottiene già — la geolocalizzazione all'apertura della mappa, o il pulsante "la
 * mia posizione". È una garanzia più forte di un controllo sui permessi: non esiste
 * alcun percorso in cui questa funzione possa far comparire un prompt, e a differenza
 * di `navigator.permissions.query` (che su WebKit riporta `prompt` anche a permesso
 * concesso) funziona su tutti i browser.
 *
 * La posizione non lascia il dispositivo: le geometrie si scaricano e il confronto
 * avviene qui.
 */
export function DpcPositionWarning() {
  const posizione = usePositionStore((s) => s.lastKnown);
  const online = useOnline();
  const dpcInStore = useEmergencyStore((s) => s.dpc);
  const layerAttivo = useItineraryStore(
    (s) => s.settings.mapDisplay.emergencyLayers.includes('dpc-alerts')
  );
  const [alert, setAlert] = useState<PositionAlert | null>(null);
  const [giorno, setGiorno] = useState('');
  const [chiuso, setChiuso] = useState(false);

  useEffect(() => {
    if (posizione == null) return;   // nessuna posizione: nessun avviso, e nessun prompt
    // Offline i dati di emergenza sono esclusi dalla cache per scelta, quindi non c'è
    // nulla da consultare: inutile avviare una catena condannata.
    // `useOnline` parte da `true` per non rompere l'idratazione e si corregge nel suo
    // effetto: qui dentro il valore reale è già leggibile, e leggerlo evita di far
    // partire la catena una volta prima della correzione.
    if (!online || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;

    const controller = new AbortController();

    void (async () => {
      const oggi = toYmd(new Date());

      let dati = zonesFromStore(oggi);
      if (dati == null) {
        if (layerAttivo) return; // il layer sta caricando: si riprova al prossimo dpc
        try {
          const { fetchDpcTodayZones } = await import('@/lib/emergency-api');
          const scaricate = await fetchDpcTodayZones(controller.signal);
          if (controller.signal.aborted || scaricate == null) return;
          dati = { zones: scaricate.zones, bulletinId: scaricate.bulletinId };
        } catch {
          // Controllo di cortesia all'avvio: un errore qui non va messo davanti
          // all'utente. Il pannello lo dirà, se e quando accenderà il layer.
          return;
        }
      }
      if (controller.signal.aborted) return;
      if (alreadyShown(dati.bulletinId)) return;

      const esito = checkPosition(dati.zones, posizione.lat, posizione.lon);
      // 'unknown' non è 'clear': geometrie illeggibili non devono diventare un
      // "nessuna allerta" definitivo, quindi non si marca nulla e si riproverà.
      if (esito.outcome !== 'alert') return;

      markShown(dati.bulletinId);
      setGiorno('oggi');
      setAlert(esito.alert);
    })();

    return () => controller.abort();
  }, [posizione, online, dpcInStore, layerAttivo]);

  if (alert == null || chiuso) return null;

  const grave = positionAlertSeverity(alert) === 'severe';
  return (
    <div
      role="alert"
      // In flusso normale come OfflineBanner e UpdateBanner: un avviso che copre la
      // bottom navigation lascerebbe l'app senza navigazione finché non lo si chiude.
      className={`shrink-0 flex items-start gap-2 px-3 py-2 text-xs font-medium ${
        grave ? 'bg-red-700 text-white' : 'bg-amber-600 text-black'
      }`}
    >
      <span aria-hidden className="leading-tight pt-0.5">⚠</span>
      <span className="flex-1 leading-snug">{positionAlertMessage(alert, giorno)}</span>
      <button
        onClick={() => setChiuso(true)}
        aria-label="Chiudi avviso allerta"
        className="shrink-0 opacity-70 hover:opacity-100 px-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        ✕
      </button>
    </div>
  );
}
