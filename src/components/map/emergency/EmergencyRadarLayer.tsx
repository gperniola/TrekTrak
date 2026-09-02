'use client';

import { useEffect, useRef, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import type L from 'leaflet';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { tileUrl, type RadarIndex } from '@/lib/radar-api';
import {
  PASSO_MS,
  chiedi,
  fotogrammaVisibile,
  inCaricamento,
  mostraComunque,
  pronto,
  prossimo,
  scadutaLaPazienza,
  statoIniziale,
  type Strato,
} from '@/lib/radar-anim';

/**
 * Tile del radar precipitazioni, **a due strati**.
 *
 * Mostra il **passato** — le ultime due ore — perché è tutto ciò che il piano gratuito
 * di RainViewer espone: `nowcast` è vuoto. L'animazione serve a vedere da dove arriva
 * una cella e dove sta andando, che è la domanda utile sul posto; la legenda dice
 * chiaramente che non è una previsione, per non far credere il contrario.
 *
 * ## I due strati
 *
 * Prima ce n'era uno, rimontato a ogni fotogramma (`key={frame.path}`) perché altrimenti
 * Leaflet riusava i tile in cache e l'animazione restava ferma. Ma rimontare toglie lo
 * strato vecchio **prima** che il nuovo abbia scaricato: fra i due a schermo non c'è
 * niente, e la pioggia lampeggia — segnalato il 2026-09-02.
 *
 * Ora uno si vede e sull'altro, invisibile, si carica il fotogramma successivo; si
 * scambiano quando è pronto. Le richieste sono le stesse, solo anticipate, e non esiste
 * un istante senza pioggia a schermo. Le regole della macchina — chi carica, quando si
 * scambia, cosa fare se un fotogramma non arriva — stanno in `lib/radar-anim.ts`, senza
 * Leaflet, con i loro casi limite.
 */
export function EmergencyRadarLayer({ radar }: { radar: RadarIndex }) {
  const frameIndex = useEmergencyStore((s) => s.radarFrame);
  const playing = useEmergencyStore((s) => s.radarPlaying);

  // -1 significa "il più recente": così un aggiornamento che aggiunge un fotogramma
  // non lascia l'utente indietro di dieci minuti senza accorgersene.
  const ultimo = radar.frames.length - 1;
  const chiesto = frameIndex < 0 ? ultimo : Math.min(Math.max(0, frameIndex), ultimo);

  const [stato, setStato] = useState(() => statoIniziale(chiesto));

  /*
    Il fotogramma chiesto — dallo slider o dall'animazione — si mette a caricare sullo
    strato nascosto. Non si scrive mai direttamente su quello visibile: e' l'unica regola
    che impedisce il lampeggio.
  */
  useEffect(() => {
    setStato((s) => chiedi(s, chiesto, Date.now()));
  }, [chiesto]);

  /*
    L'animazione avanza **quando il fotogramma e' pronto**, non a scatti di orologio: con
    una rete lenta un timer fisso chiederebbe fotogrammi che non fanno in tempo ad
    arrivare, e si tornerebbe a lampeggiare. Il timer qui serve solo a non correre troppo
    e a dare una scadenza a un caricamento che non finisce.
  */
  useEffect(() => {
    if (!playing || radar.frames.length < 2) return;
    const t = setInterval(() => {
      const adesso = Date.now();
      setStato((s) => {
        // Se un fotogramma si sta aspettando: si aspetta, oppure e' finita la pazienza.
        if (inCaricamento(s) != null) {
          return scadutaLaPazienza(s, adesso) ? mostraComunque(s) : s;
        }
        const p = prossimo(s, radar.frames.length);
        // Si scrive anche nello store, cosi' lo slider e l'orario seguono l'animazione.
        useEmergencyStore.setState({ radarFrame: p });
        return chiedi(s, p, adesso);
      });
    }, PASSO_MS);
    return () => clearInterval(t);
  }, [playing, radar.frames.length]);

  /*
    Le chiavi degli strati sono FISSE ('a' e 'b'): e' l'opposto di prima, dove la chiave
    cambiava col fotogramma e causava il rimontaggio. Qui cambia solo la `url`, e
    react-leaflet chiama `setUrl` sullo strato che deve ricaricare — mentre l'altro resta
    a schermo con la sua pioggia.
  */
  const visibile = fotogrammaVisibile(stato);
  if (visibile == null) return null;

  return (
    <>
      {(['a', 'b'] as Strato[]).map((strato) => {
        const contenuto = stato[strato];
        if (contenuto == null) return null;
        const frame = radar.frames[contenuto.indice];
        if (!frame) return null;
        return (
          <StratoRadar
            key={strato}
            url={tileUrl(radar, frame)}
            visibile={stato.visibile === strato}
            onPronto={() => setStato((s) => pronto(s, strato))}
          />
        );
      })}
    </>
  );
}

/**
 * Uno dei due strati.
 *
 * L'opacità si cambia **a mano sull'oggetto Leaflet** e non con la prop di react-leaflet:
 * passandola come prop, react-leaflet la applica al prossimo render e per un istante
 * entrambi gli strati sono visibili o nessuno lo è. Qui lo scambio è una sola scrittura.
 */
function StratoRadar({
  url, visibile, onPronto,
}: { url: string; visibile: boolean; onPronto: () => void }) {
  const riferimento = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    riferimento.current?.setOpacity(visibile ? OPACITA : 0);
  }, [visibile]);

  return (
    <TileLayer
      ref={(l) => {
        riferimento.current = l as unknown as L.TileLayer | null;
        (l as unknown as L.TileLayer | null)?.setOpacity(visibile ? OPACITA : 0);
      }}
      url={url}
      pane={EMERGENCY_PANE}
      opacity={visibile ? OPACITA : 0}
      /*
       * Sette, non dodici. MISURATO sui tile veri: da zoom 8 in su RainViewer
       * restituisce sempre lo stesso PNG da 1370 byte, grigio al 100% — il placeholder
       * "Zoom Not Supported". A zoom 7 il tile e' vero (334 byte sull'area di prova).
       *
       * Con il limite sbagliato la mappa a zoom da escursionista si copriva della
       * scritta "Zoom Not Supported": si vedeva solo aprendo il layer sul serio, non
       * nei test. Con 7, Leaflet chiede i tile validi e li ingrandisce: sfocato, ma
       * vero — e per capire da dove arriva una cella la sfocatura non conta.
       */
      maxNativeZoom={7}
      // Lo strato nascosto sta sotto: cosi' non copre quello che si vede mentre carica.
      zIndex={visibile ? 3 : 2}
      eventHandlers={{ load: onPronto }}
    />
  );
}

/** L'opacità dello strato visibile: la pioggia deve lasciar leggere la mappa sotto. */
const OPACITA = 0.65;
