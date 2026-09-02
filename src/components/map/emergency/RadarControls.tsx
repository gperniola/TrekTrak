'use client';

import { useEmergencyStore } from '@/stores/emergencyStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useMapOverlayGuard } from '../useMapOverlayGuard';

/**
 * I comandi dell'animazione radar, **sulla mappa**.
 *
 * Segnalato il 2026-09-02: «i controlli con lo slider che avanza devono apparire non solo
 * nel menu ma anche sulla mappa, preferibilmente in basso, quando questa è attivata,
 * altrimenti l'utente non si rende conto di cosa sta succedendo».
 *
 * È il difetto di aver messo il comando dove si *accende* la cosa invece di dove la cosa
 * *si vede*: si apriva il pannello dei layer, si accendeva il radar, si chiudeva il
 * pannello per guardare la mappa — e da quel momento la pioggia si muoveva senza che
 * niente dicesse che era un'animazione, di che ora, né come fermarla.
 *
 * I comandi restano **anche** nel pannello: là si sta scegliendo cosa vedere, e chi ha il
 * pannello aperto non deve chiuderlo per mettere in pausa.
 *
 * ## L'orario è la parte che non si può togliere
 *
 * Il piano gratuito di RainViewer espone solo il passato: anche il fotogramma più recente
 * ha fino a dieci minuti. Senza l'orario a schermo, un'animazione di pioggia che si muove
 * si legge come «adesso», ed è la classe di difetto che questo progetto ha già corretto
 * più volte — dato vecchio presentato come attuale.
 */
export function RadarControls() {
  const guardia = useMapOverlayGuard();
  /*
    Se il layer e' accesso lo dice le impostazioni, non lo store di runtime: e' la stessa
    fonte che legge la riga del pannello, e due fonti per la stessa cosa divergono.
  */
  const accesi = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);
  const radar = useEmergencyStore((s) => s.radar);
  const frameIndex = useEmergencyStore((s) => s.radarFrame);
  const playing = useEmergencyStore((s) => s.radarPlaying);
  const toggleRadarPlay = useEmergencyStore((s) => s.toggleRadarPlay);
  const setRadarFrame = useEmergencyStore((s) => s.setRadarFrame);

  // Si mostra solo col layer accesso e i fotogrammi in mano: prima di allora non c'e'
  // niente da comandare, e una barra vuota sulla mappa e' solo ingombro.
  if (!accesi.includes('rain-radar')) return null;
  if (radar == null || radar.frames.length < 2) return null;

  const ultimoIndice = radar.frames.length - 1;
  const indice = frameIndex < 0 ? ultimoIndice : Math.min(Math.max(0, frameIndex), ultimoIndice);
  const frame = radar.frames[indice];
  if (!frame) return null;

  const orario = new Date(frame.timeISO).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
  });
  const suUltimo = indice === ultimoIndice;

  return (
    <div
      ref={guardia}
      /*
        In basso al centro, e le misure sono MISURATE sullo schermo, non scelte a occhio.
        Alla prima stesura (`bottom-7`, larghezza `100%-6rem`) su 412x823 il bordo
        sinistro finiva **sopra il pulsante tondo degli strumenti** (barra da 58 px, il
        pulsante arriva a 68) e la didascalia **tagliava la riga delle attribuzioni**, che
        va sempre lasciata leggibile.
        Ora: 76 px liberi per lato — il pulsante a sinistra ne occupa 68, quelli a destra
        cominciano a 56 dal bordo — e 48 px dal fondo, che tengono la barra sopra le
        attribuzioni. Il guardiano in `e2e/radar-comandi.spec.ts` lo verifica a schermo.
      */
      className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000] w-[min(22rem,calc(100%-9.5rem))]
        rounded-lg bg-gray-900/90 border border-gray-700 px-2 py-1.5 shadow-lg backdrop-blur-sm"
      role="group"
      aria-label="Animazione radar pioggia"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={toggleRadarPlay}
          aria-label={playing ? 'Ferma animazione radar' : 'Anima le ultime due ore di radar'}
          className="px-2 min-h-[32px] max-lg:min-h-[44px] rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-100 shrink-0"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={ultimoIndice}
          value={indice}
          onChange={(e) => setRadarFrame(Number(e.target.value))}
          aria-label="Fotogramma radar"
          className="flex-1 accent-sky-400 min-w-0"
        />
        <span className="text-[11px] font-mono text-gray-100 tabular-nums shrink-0">{orario}</span>
      </div>
      {/*
        Una riga sola, e dice la cosa che conta: che è pioggia già caduta. Due righe qui
        coprirebbero la mappa, che è quello che si sta guardando.
      */}
      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
        {suUltimo
          ? 'Pioggia già caduta, non prevista — fotogramma più recente'
          : `Pioggia già caduta — fotogramma di ${orario}`}
      </p>
    </div>
  );
}
