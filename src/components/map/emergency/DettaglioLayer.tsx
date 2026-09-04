'use client';

import { useEmergencyStore } from '@/stores/emergencyStore';
import { dayOptions } from '@/lib/dpc';
import { oraItaliana } from '@/lib/formato';
import { descriviFinestra, type FinestraRilevazioni } from '@/lib/eta-focolai';
import type { EmergencyLayerDef } from '@/lib/emergency-layers';
import type { LayerRuntime } from '@/stores/emergencyStore';

/**
 * **Il dettaglio a fisarmonica di un layer: una riga per volta.**
 *
 * Prima ogni layer acceso si portava dietro per sempre descrizione, legenda (fino a sei
 * voci), stato e comandi: il pannello **puniva chi lo usava**. Dalla v0.14.0 il dettaglio
 * si apre su richiesta, e questo è il suo contenuto — materiale di consultazione, non
 * avvisi (quelli restano visibili a riga chiusa, in `AvvisiLayer`).
 */
export function DettaglioLayer(
  { def, id, attivo, runtime, finestraFocolai }: {
    def: EmergencyLayerDef;
    /** L'id dell'elemento, per `aria-controls` sul pulsante che lo apre. */
    id: string;
    attivo: boolean;
    runtime: LayerRuntime;
    finestraFocolai: FinestraRilevazioni | null;
  },
) {
  return (
    <div id={id} className="pb-2 space-y-1.5">
      <div className="text-[10px] text-gray-400">{def.description}</div>
      <div className="flex flex-wrap gap-2">
        {def.legend.map((e) => (
          <span key={e.label} className="flex items-center gap-1 text-[10px] text-gray-300">
            <span className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: e.color }} />
            {e.label}
          </span>
        ))}
      </div>
      {/* Il gesto va detto: una pressione lunga non si scopre da sola. */}
      {def.wms?.queryable && (
        <div className="text-[10px] text-gray-400">
          Tieni premuto sulla mappa per i dettagli dell&apos;area
        </div>
      )}
      {/*
        Due orari distinti, e la distinzione e' il punto: "scaricato" e' quando abbiamo
        chiesto noi, "passaggi satellite" e' quando il satellite ha guardato. Prima c'era
        solo il primo, con l'etichetta "Aggiornato alle" che lasciava credere fosse il
        secondo.
      */}
      {attivo && finestraFocolai && (
        <div className="text-[10px] text-gray-300">{descriviFinestra(finestraFocolai)}</div>
      )}
      {attivo && runtime.lastFetch != null && (
        <div className="text-[10px] text-gray-400">
          {finestraFocolai ? 'Scaricato alle ' : 'Aggiornato alle '}
          {oraItaliana(runtime.lastFetch)}
        </div>
      )}
      {attivo && def.id === 'rain-radar' && <ComandiRadar />}
      {attivo && def.id === 'dpc-alerts' && <GiorniDpc />}
    </div>
  );
}

/**
 * I comandi del radar dentro il pannello: play, cursore e l'orario del fotogramma.
 *
 * **L'orario va mostrato sempre**: è l'unico modo di non far credere che il radar sia
 * «adesso». Il piano gratuito espone solo il passato, quindi anche il fotogramma più
 * recente ha fino a dieci minuti.
 */
function ComandiRadar() {
  const radar = useEmergencyStore((s) => s.radar);
  const radarFrame = useEmergencyStore((s) => s.radarFrame);
  const radarPlaying = useEmergencyStore((s) => s.radarPlaying);
  const setRadarFrame = useEmergencyStore((s) => s.setRadarFrame);
  const toggleRadarPlay = useEmergencyStore((s) => s.toggleRadarPlay);

  if (!radar || radar.frames.length === 0) return null;

  const indice = radarFrame < 0 ? radar.frames.length - 1 : Math.min(radarFrame, radar.frames.length - 1);
  const frame = radar.frames[indice];
  const orario = new Date(frame.timeISO).toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
  });
  const ultimo = indice === radar.frames.length - 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleRadarPlay}
          aria-label={radarPlaying ? 'Ferma animazione radar' : 'Anima le ultime due ore di radar'}
          className="px-2 min-h-[32px] max-lg:min-h-[44px] rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-100"
        >
          {radarPlaying ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={radar.frames.length - 1}
          value={indice}
          onChange={(e) => setRadarFrame(Number(e.target.value))}
          aria-label="Fotogramma radar"
          className="flex-1 accent-sky-400"
        />
        <span className="text-[11px] font-mono text-gray-200 tabular-nums">{orario}</span>
      </div>
      <p className="text-[10px] text-gray-400">
        {ultimo
          ? 'Fotogramma più recente disponibile. È pioggia GIÀ CADUTA, non una previsione: serve a vedere da dove arriva la cella.'
          : `Fotogramma di ${orario}. Scorri fino a destra per il più recente.`}
      </p>
    </div>
  );
}

/** La scelta del giorno del bollettino DPC, e la data di emissione. */
function GiorniDpc() {
  const dpc = useEmergencyStore((s) => s.dpc);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const setDpcSelectedDate = useEmergencyStore((s) => s.setDpcSelectedDate);
  /*
    `nowTick` (5 min) serve a rietichettare i giorni dopo la mezzanotte: «oggi» e «domani»
    sono etichette calcolate, e senza un orologio resterebbero quelle del momento in cui
    si è aperto il pannello.
  */
  const nowTick = useEmergencyStore((s) => s.nowTick);

  if (!dpc) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {dayOptions(dpc.days.map((d) => d.date), new Date(nowTick)).map((o) => (
          <button
            key={o.date}
            disabled={o.disabled}
            onClick={() => setDpcSelectedDate(o.date)}
            className={`px-2 py-1 rounded text-[10px] max-lg:min-h-[36px] ${
              o.date === dpcSelectedDate ? 'bg-amber-500 text-black font-bold' : 'bg-gray-700 text-gray-300'
            } disabled:opacity-40`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-gray-400">Bollettino del {dpc.issuedLabel}</div>
    </div>
  );
}
