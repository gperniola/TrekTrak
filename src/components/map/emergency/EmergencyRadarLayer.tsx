'use client';

import { useEffect } from 'react';
import { TileLayer } from 'react-leaflet';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { tileUrl, type RadarIndex } from '@/lib/radar-api';

/** Un fotogramma ogni 700 ms: abbastanza lento da seguire una cella con l'occhio. */
const PASSO_MS = 700;

/**
 * Tile del radar precipitazioni, un fotogramma per volta.
 *
 * Mostra il **passato** — le ultime due ore — perché è tutto ciò che il piano gratuito
 * di RainViewer espone: `nowcast` è vuoto. L'animazione serve a vedere da dove arriva
 * una cella e dove sta andando, che è la domanda utile sul posto; la legenda dice
 * chiaramente che non è una previsione, per non far credere il contrario.
 */
export function EmergencyRadarLayer({ radar }: { radar: RadarIndex }) {
  const frameIndex = useEmergencyStore((s) => s.radarFrame);
  const playing = useEmergencyStore((s) => s.radarPlaying);
  const setFrame = useEmergencyStore((s) => s.setRadarFrame);

  // -1 significa "il più recente": così un aggiornamento che aggiunge un fotogramma
  // non lascia l'utente indietro di dieci minuti senza accorgersene.
  const indice = frameIndex < 0 ? radar.frames.length - 1 : Math.min(frameIndex, radar.frames.length - 1);
  const frame = radar.frames[indice];

  useEffect(() => {
    if (!playing || radar.frames.length < 2) return;
    const t = setInterval(() => {
      const s = useEmergencyStore.getState();
      const attuale = s.radarFrame < 0 ? radar.frames.length - 1 : s.radarFrame;
      const prossimo = attuale + 1 >= radar.frames.length ? 0 : attuale + 1;
      // Si scrive direttamente: `setRadarFrame` ferma l'animazione, ed è giusto che lo
      // faccia quando è l'utente a trascinare lo slider.
      useEmergencyStore.setState({ radarFrame: prossimo });
    }, PASSO_MS);
    return () => clearInterval(t);
  }, [playing, radar.frames.length]);

  if (!frame) return null;

  return (
    <TileLayer
      // La chiave forza il rimontaggio a ogni cambio di fotogramma: senza, Leaflet
      // riusa i tile già in cache e l'animazione resta ferma.
      key={frame.path}
      url={tileUrl(radar, frame)}
      pane={EMERGENCY_PANE}
      opacity={0.65}
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
      zIndex={2}
    />
  );
}
