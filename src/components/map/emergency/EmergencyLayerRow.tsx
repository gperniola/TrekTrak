'use client';

import { useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { saveSettings, KEYS } from '@/lib/storage';
import { confirm as appConfirm } from '@/stores/notificationStore';
import {
  CATEGORY_ICONS,
  CATEGORY_NAMES,
  type EmergencyLayerDef,
  type EmergencyLayerId,
} from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';
import { useOnline } from '@/lib/useOnline';
import { oraItaliana } from '@/lib/formato';
import { dataBollettino } from '@/lib/avalanche-api';
import { finestraRilevazioni, descriviFinestra, descriviEta, datoVecchio } from '@/lib/eta-focolai';
import type { AppSettings } from '@/lib/types';

export const DISCLAIMER =
  'I dati provengono da satelliti e bollettini ufficiali ma possono essere incompleti o in ritardo. ' +
  'Non sostituiscono i canali ufficiali di allerta. In caso di emergenza chiama il 112.';

/**
 * Il pallino di stato, con la sua parola.
 *
 * Il colore da solo non basta: nella tabella del meteo il pallino era `aria-hidden` e
 * chi usa un lettore di schermo non sapeva nulla della gravità. Qui la parola entra nel
 * nome accessibile della riga.
 */
interface Indicatore { classe: string; parola: string; }

export function indicatoreStato(
  attivo: boolean,
  runtime: { status: string; partial?: boolean },
  online: boolean,
  stantio: boolean,
): Indicatore | null {
  if (!attivo) return null;
  if (!online) return { classe: 'bg-amber-400', parola: 'non disponibile offline' };
  if (runtime.status === 'loading') return { classe: 'bg-gray-400 animate-pulse', parola: 'in caricamento' };
  if (runtime.status === 'error') return { classe: 'bg-red-500', parola: 'errore' };
  if (runtime.status === 'nodata') return { classe: 'bg-amber-400', parola: 'nessun dato' };
  if (runtime.status === 'ready' && runtime.partial) return { classe: 'bg-amber-400', parola: 'dati parziali' };
  if (runtime.status === 'ready' && stantio) return { classe: 'bg-amber-400', parola: 'dati non aggiornati' };
  if (runtime.status === 'ready') return { classe: 'bg-green-500', parola: 'aggiornato' };
  return null;
}

interface Props {
  def: EmergencyLayerDef;
  aperta: boolean;
  onApri: () => void;
}

export function EmergencyLayerRow({ def, aperta, onApri }: Props) {
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const runtime = useEmergencyStore((s) => s.layers[def.id]);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const stopLayer = useEmergencyStore((s) => s.stopLayer);
  const retryLayer = useEmergencyStore((s) => s.retryLayer);
  const isStale = useEmergencyStore((s) => s.isStale);
  // `isStale` legge `Date.now()` in fase di render: senza qualcosa che provochi un
  // nuovo render, il badge "dati non aggiornati" non compariva mai — e cioè proprio
  // quando serve. `nowTick` (5 min) è quel qualcosa, e serve anche a rietichettare i
  // giorni DPC dopo la mezzanotte.
  const nowTick = useEmergencyStore((s) => s.nowTick);
  const online = useOnline();
  const dpc = useEmergencyStore((s) => s.dpc);
  const fires = useEmergencyStore((s) => s.fires);
  const radar = useEmergencyStore((s) => s.radar);
  const radarFrame = useEmergencyStore((s) => s.radarFrame);
  const radarPlaying = useEmergencyStore((s) => s.radarPlaying);
  const setRadarFrame = useEmergencyStore((s) => s.setRadarFrame);
  const toggleRadarPlay = useEmergencyStore((s) => s.toggleRadarPlay);
  const avalanche = useEmergencyStore((s) => s.avalanche);
  const xyzGiorno = useEmergencyStore((s) => s.xyzGiorno);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const setDpcSelectedDate = useEmergencyStore((s) => s.setDpcSelectedDate);

  const active = settings.mapDisplay.emergencyLayers.includes(def.id);
  const stantio = active && isStale(def.id);
  const stato = indicatoreStato(active, runtime, online, stantio);
  // Giornata calma: bollettino valido, nessuna zona sopra il livello 0. È il caso più
  // frequente, e senza dirlo espressamente resta una mappa vuota da interpretare.
  /*
   * L'eta' VERA dei dati satellitari, che non e' l'ora in cui li abbiamo chiesti.
   * `nowTick` (5 min) fa da orologio: senza qualcosa che provochi un nuovo render
   * l'eta' resterebbe quella del momento in cui si e' aperto il pannello.
   */
  const finestraFocolai = def.id === 'fires-hotspots' && fires
    ? finestraRilevazioni(fires.points, nowTick)
    : null;
  const focolaiVecchi = finestraFocolai != null && datoVecchio(finestraFocolai);

  const selectedDay = dpc?.days.find((d) => d.date === dpcSelectedDate);
  const calmDay = selectedDay != null && selectedDay.zones.every((z) => z.maxLevel === 0);
  // Guardia anti-rientranza: un secondo tap mentre il disclaimer è in attesa di risposta
  // (await appConfirm) viene ignorato invece di aprire un secondo dialog.
  const pendingRef = useRef(false);

  const persist = (base: AppSettings, list: EmergencyLayerId[]) => {
    const newSettings = { ...base, mapDisplay: { ...base.mapDisplay, emergencyLayers: list } };
    updateSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleToggle = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      // Legge lo stato fresco dello store (non la chiusura di `settings` catturata al
      // render): tra il click e questo punto — e soprattutto dopo l'`await appConfirm`
      // sotto — un altro toggle può aver già aggiornato i settings altrove.
      const base = useItineraryStore.getState().settings;
      const isActiveNow = base.mapDisplay.emergencyLayers.includes(def.id);
      if (isActiveNow) {
        persist(base, base.mapDisplay.emergencyLayers.filter((id) => id !== def.id));
        stopLayer(def.id);
        return;
      }
      let seen = false;
      try { seen = localStorage.getItem(KEYS.emergencyDisclaimer) === '1'; } catch { /* noop */ }
      if (!seen) {
        const ok = await appConfirm({
          title: 'Layer di emergenza', message: DISCLAIMER,
          variant: 'info', confirmText: 'Ho capito', cancelText: 'Annulla',
        });
        if (!ok) return;
        try { localStorage.setItem(KEYS.emergencyDisclaimer, '1'); } catch { /* noop */ }
      }
      const fresh = useItineraryStore.getState().settings;
      if (!fresh.mapDisplay.emergencyLayers.includes(def.id)) {
        persist(fresh, [...fresh.mapDisplay.emergencyLayers, def.id]);
      }
      startLayer(def.id);
    } finally {
      pendingRef.current = false;
    }
  };

  const idDettaglio = `dettaglio-${def.id}`;

  /*
   * Cosa resta visibile a riga chiusa: tutto quello che qualifica l'ATTENDIBILITÀ del
   * dato. Il dettaglio si comprime quando va tutto bene, non quando c'è qualcosa da
   * sapere — un pallino colorato che non spiega niente sarebbe un passo indietro.
   */
  const avvisi = active ? (
    <div className="space-y-0.5 pb-1.5">
      {/* Spec §6: da offline la riga dice "non disponibile offline", non un errore di
          rete. I dati di emergenza sono esclusi dalla cache di proposito. */}
      {!online && <div className="text-[10px] text-amber-400">⚠ non disponibile offline</div>}
      {online && runtime.status === 'error' && (
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-red-400 flex-1">⚠ {runtime.error}</div>
          <button
            onClick={() => retryLayer(def.id)}
            className="shrink-0 px-2 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 text-gray-100 max-lg:min-h-[32px]"
          >
            Riprova
          </button>
        </div>
      )}
      {/* "nessun dato" non è un guasto: la fonte ha risposto e per quel giorno non c'è
          nulla. Va detto, non lasciato indovinare da una mappa vuota. */}
      {runtime.status === 'nodata' && (
        <div className="text-[10px] text-gray-300">
          Nessun dato disponibile{runtime.error ? ` — ${runtime.error}` : ''}
        </div>
      )}
      {runtime.partial && runtime.status === 'ready' && (
        <div className="text-[10px] text-amber-400">
          {/*
            "Parziale" vuol dire cose diverse a seconda del layer, e un messaggio riusato
            dice il falso: per i ripari e i terremoti l'elenco e' stato TAGLIATO da un
            tetto nostro, per le valanghe una regione su nove non ha risposto, per i
            focolai qualche sensore. Tre cause, tre frasi.
          */}
          {def.id === 'shelters'
            ? '⚠ troppi ripari in quest’area: ne vedi solo una parte, avvicinati per l’elenco completo'
            : def.id === 'earthquakes'
              ? '⚠ molti eventi in corso: ne vedi solo i primi 300'
              : def.id === 'avalanche-danger'
                ? '⚠ bollettino incompleto: qualche servizio regionale non ha risposto'
                : '⚠ dati parziali: alcune fonti non hanno risposto'}
        </div>
      )}
      {/* Prima questo avviso stava attaccato all'orario; ora che l'orario è materiale di
          consultazione e sta nel dettaglio, l'avviso deve reggersi da solo. */}
      {stantio && runtime.status === 'ready' && (
        <div className="text-[10px] text-amber-400">⚠ dati non aggiornati</div>
      )}
      {/*
        Focolai vecchi: oltre le sei ore l'eta' del dato non e' piu' materiale di
        consultazione ma una cosa da sapere prima di fidarsi della mappa — il satellite
        passa due volte al giorno, e fra un passaggio e l'altro non si vede niente.
      */}
      {focolaiVecchi && finestraFocolai && (
        <div className="text-[10px] text-amber-400">
          ⚠ ultimo passaggio del satellite {descriviEta(finestraFocolai.etaMinuti)}
        </div>
      )}
      {/*
        DI CHE GIORNO e' il dato.

        Vale per i due layer nuovi che mostrano una giornata precisa e non "adesso": il
        bollettino valanghe (uno al giorno, e in stagione quello del pomeriggio vale per
        il giorno dopo) e l'immagine satellitare della neve (un passaggio al giorno, e col
        ripiego puo' essere di ieri). L'orario in cui li abbiamo CHIESTI non dice niente
        su quale giornata stiano descrivendo: e' la distinzione che in questo progetto e'
        gia' costata due rilasci.
      */}
      {def.id === 'avalanche-danger' && avalanche?.bulletinDate != null && runtime.status === 'ready' && (
        <div className="text-[10px] text-gray-300">
          Bollettino del {dataBollettino(avalanche.bulletinDate)} · {avalanche.zones.length}
          {avalanche.zones.length === 1 ? ' zona' : ' zone'} in questa vista
        </div>
      )}
      {def.id === 'snow-cover' && xyzGiorno['snow-cover'] != null && runtime.status === 'ready' && (
        <div className="text-[10px] text-gray-300">
          Immagine del {dataBollettino(xyzGiorno['snow-cover'] as string)}
        </div>
      )}
      {/* Giornata calma: senza questa riga un layer acceso su una mappa vuota è
          indistinguibile da un layer rotto, e sono la maggioranza dei giorni. */}
      {def.id === 'dpc-alerts' && calmDay && (
        <div className="text-[10px] text-green-400">Nessuna zona in allerta per questo giorno</div>
      )}
    </div>
  ) : null;

  return (
    <div className="border-b border-gray-700 last:border-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onApri}
          aria-expanded={aperta}
          aria-controls={idDettaglio}
          /*
            Nome dichiarato invece che dedotto dal contenuto: aggiunge due cose che a
            schermo sono affidate a un'icona e a un colore (la categoria e lo stato), e
            il contenuto non le direbbe nella forma giusta — fra elementi diversi il
            browser infila uno spazio, e veniva letto "Radar pioggia , aggiornato".
          */
          aria-label={`${CATEGORY_NAMES[def.category]}: ${def.label}${stato ? `, ${stato.parola}` : ''}`}
          className="flex-1 flex items-center gap-2 py-2 text-left max-lg:min-h-[44px]
                     focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
        >
          <span aria-hidden="true" className="text-sm shrink-0">{CATEGORY_ICONS[def.category]}</span>
          <span className="text-sm text-gray-100 flex-1 leading-tight">{def.label}</span>
          {stato && (
            <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${stato.classe}`} />
          )}
          <span aria-hidden="true" className="text-gray-400 text-[10px] shrink-0">{aperta ? '▲' : '▼'}</span>
        </button>
        <button
          role="switch"
          aria-checked={active}
          aria-label={def.label}
          onClick={handleToggle}
          className="relative shrink-0 flex items-center justify-center rounded max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-2
                     focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          <span className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-amber-500' : 'bg-gray-600'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${active ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      </div>

      {avvisi}

      {aperta && (
        <div id={idDettaglio} className="pb-2 space-y-1.5">
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
            Due orari distinti, e la distinzione e' il punto: "scaricato" e' quando
            abbiamo chiesto noi, "passaggi satellite" e' quando il satellite ha
            guardato. Prima c'era solo il primo, con l'etichetta "Aggiornato alle" che
            lasciava credere fosse il secondo.
          */}
          {active && finestraFocolai && (
            <div className="text-[10px] text-gray-300">{descriviFinestra(finestraFocolai)}</div>
          )}
          {active && runtime.lastFetch != null && (
            <div className="text-[10px] text-gray-400">
              {finestraFocolai ? 'Scaricato alle ' : 'Aggiornato alle '}
              {oraItaliana(runtime.lastFetch)}
            </div>
          )}
          {active && def.id === 'rain-radar' && radar && radar.frames.length > 0 && (() => {
            const indice = radarFrame < 0 ? radar.frames.length - 1 : Math.min(radarFrame, radar.frames.length - 1);
            const frame = radar.frames[indice];
            const orario = new Date(frame.timeISO).toLocaleTimeString('it-IT', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
            });
            const ultimo = indice === radar.frames.length - 1;
            return (
              <div className="space-y-1">
                {/* L'orario del fotogramma va mostrato SEMPRE: è l'unico modo di non far
                    credere che il radar sia "adesso". Il piano gratuito espone solo il
                    passato, quindi anche il fotogramma più recente ha fino a dieci minuti. */}
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
          })()}
          {active && def.id === 'dpc-alerts' && dpc && (
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
          )}
        </div>
      )}
    </div>
  );
}
